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
   components: z.array(z.string()).optional(),
   yes: z.boolean(),
   overwrite: z.boolean(),
   cwd: z.string(),
   path: z.string().optional(),
})

export const add = new Command()
   .name('add')
   .description('add a component to your project')
   .argument('[components...]', 'the components to add')
   .option('-y, --yes', 'skip confirmation prompt.', true)
   .option('-o, --overwrite', 'overwrite existing files.', false)
   .option(
      '-c, --cwd <cwd>',
      'the working directory. defaults to the current directory.',
      process.cwd(),
   )
   .option('-p, --path <path>', 'the path to add the component to.')
   .action(async (components, opts) => {
      try {
         const options = addOptionsSchema.parse({
            components,
            ...opts,
         })

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
          )} to create a genies.json file.`,
            )
            process.exit(1)
         }

         let selectedComponents = options.components
         if (!options.components?.length) {
            const { components } = await prompts({
               type: 'list',
               name: 'components',
               message: 'Which components would you like to add?',
               separator: ',',
            })
            selectedComponents = components
         }

         if (!selectedComponents?.length) {
            logger.warn('No components selected. Exiting.')
            process.exit(0)
         }

         if (!options.yes) {
            const { proceed } = await prompts({
               type: 'confirm',
               name: 'proceed',
               message: `Ready to create components. Proceed?`,
               initial: true,
            })

            if (!proceed)
               process.exit(0)
         }

         const spinner = ora(`Creating components...`).start()
         for (const componentName of selectedComponents) {
            spinner.text = `Creating ${componentName}...`
            const targetDir = options.path ? path.resolve(cwd, options.path) : path.resolve(cwd, config.componentsPath)
            const fileName = getFileName(componentName, config.style)
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
                  continue
               }

               spinner.start(`Creating ${fileName}...`)
            }

            const content = COMPONENT.replace(/<%- componentName %>/g, componentName)
            await fs.writeFile(filePath, content)
         }
         spinner.succeed(`Done.`)
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
