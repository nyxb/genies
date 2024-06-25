import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import prompts from 'prompts'
import { z } from 'zod'
import { getConfig } from '~/src/utils/get-config'
import { handleError } from '~/src/utils/handle-error'
import { logger } from '~/src/utils/logger'
import { COMPONENT } from '~/src/utils/templates'
import camelCase from 'lodash/camelCase.js'
import kebabCase from 'lodash/kebabCase.js'
import snakeCase from 'lodash/snakeCase.js'
import startCase from 'lodash/startCase.js'

const addOptionsSchema = z.object({
   yes: z.boolean(),
   overwrite: z.boolean(),
   cwd: z.string(),
   path: z.string().optional(),
})

export const add = new Command()
   .name('add')
   .description('add a component to your project')
   .argument('<component...>', 'the component to add')
   .option('-y, --yes', 'skip confirmation prompt.', true)
   .option('-o, --overwrite', 'overwrite existing files.', false)
   .option(
      '-c, --cwd <cwd>',
      'the working directory. defaults to the current directory.',
      process.cwd(),
   )
   .option('-p, --path <path>', 'the path to add the component to.')
   .action(async (componentArgs, opts) => {
      try {
         const options = addOptionsSchema.parse({
            ...opts,
         })

         const component = componentArgs.join(' ')
         const cwd = path.resolve(options.cwd)

         if (!existsSync(cwd)) {
            logger.error(`The path ${cwd} does not exist. Please try again.`)
            process.exit(1)
         }

         const config = await getConfig(cwd)
         if (!config) {
            logger.warn(
          `Configuration is missing. Please run ${chalk.green(
            `init`,
          )} to create a genies config file.`,
            )
            process.exit(1)
         }

         const spinner = ora(`Creating component...`).start()
         spinner.text = `Creating ${component}...`
         const targetDir = options.path ? path.resolve(cwd, options.path) : path.resolve(cwd, config.componentsPath.replace('~', cwd))

         // Check if the target directory exists, if not, prompt to create it
         if (!existsSync(targetDir)) {
            spinner.stop()
            const { createDir } = await prompts({
               type: 'confirm',
               name: 'createDir',
               message: `The directory ${targetDir} does not exist. Would you like to create it?`,
               initial: true,
            })

            if (!createDir) {
               logger.warn(`Directory ${targetDir} does not exist. Exiting.`)
               process.exit(0)
            }

            await fs.mkdir(targetDir, { recursive: true })
            spinner.start(`Creating ${component}...`)
         }

         const fileName = getFileName(component, config.style)
         const functionName = getFunctionName(component)
         const filePath = path.resolve(targetDir, `${fileName}.tsx`)

         if (existsSync(filePath) && !options.overwrite) {
            spinner.stop()
            const { overwrite } = await prompts({
               type: 'confirm',
               name: 'overwrite',
               message: `Component ${fileName} already exists. Would you like to overwrite?`,
               initial: false,
            })

            if (!overwrite) {
               logger.info(
                  `Skipped ${fileName}. To overwrite, run with the ${chalk.green(
                     '--overwrite',
                  )} flag.`,
               )
               return
            }

            spinner.start(`Creating ${fileName}...`)
         }

         const content = COMPONENT.replace(/<%- componentName %>/g, functionName)
         await fs.writeFile(filePath, content)
         spinner.succeed(`Component ${fileName} created successfully.`)
      }
      catch (error) {
         handleError(error)
      }
   })

function getFileName(name: string, style: string): string {
   switch (style) {
      case 'camelCase':
         return camelCase(name)
      case 'kebab-case':
         return kebabCase(name)
      case 'snake_case':
         return snakeCase(name)
      case 'Start Case':
         return startCase(name).replace(/ /g, '')
      default:
         return name
   }
}

function getFunctionName(name: string): string {
   return startCase(camelCase(name)).replace(/ /g, '')
}
