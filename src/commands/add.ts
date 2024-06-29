import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import prompts from 'prompts'
import { z } from 'zod'
import camelCase from 'lodash/camelCase.js'
import kebabCase from 'lodash/kebabCase.js'
import snakeCase from 'lodash/snakeCase.js'
import startCase from 'lodash/startCase.js'
import { getConfig } from '~/src/utils/get-config'
import { handleError } from '~/src/utils/handle-error'
import { logger } from '~/src/utils/logger'
import { COMPONENT } from '~/src/utils/templates'
import { violet } from '~/src/utils/colors'

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

         // Resolve the components path
         const baseDir = config.components.startsWith('~')
            ? path.join(cwd, config.components.slice(1))
            : path.resolve(cwd, config.components)

         const targetDir = options.path ? path.resolve(cwd, options.path) : baseDir

         // Check if the base directory exists
         if (!existsSync(baseDir)) {
            const { createBaseDir } = await prompts({
               type: 'confirm',
               name: 'createBaseDir',
               message: `The base directory ${violet(path.relative(cwd, baseDir))} does not exist. Would you like to create it?`,
               initial: true,
            })

            if (!createBaseDir) {
               logger.warn(`Directory ${violet(path.relative(cwd, baseDir))} does not exist. Exiting.`)
               process.exit(0)
            }

            await fs.mkdir(baseDir, { recursive: true })
         }

         // Get subdirectories in the base directory
         const subDirs = config.aliases || []

         let selectedDir = targetDir

         const { useSubDir } = await prompts({
            type: 'confirm',
            name: 'useSubDir',
            message: 'Do you want to create the component in a subdirectory?',
            initial: false,
         })

         if (useSubDir) {
            const { chosenDir } = await prompts({
               type: 'select',
               name: 'chosenDir',
               message: 'Select a directory to add the component to:',
               choices: subDirs.map(dir => ({ title: dir, value: path.resolve(baseDir, dir) })),
            })

            selectedDir = chosenDir
         }

         const fileName = getFileName(component, config.style)
         const functionName = getFunctionName(component)
         const filePath = path.resolve(selectedDir, `${fileName}.${config.fileExtension}`)

         // Check if the component already exists in the selected directory
         if (existsSync(filePath) && !options.overwrite) {
            const { overwrite } = await prompts({
               type: 'confirm',
               name: 'overwrite',
               message: `Component ${chalk.cyan(`${fileName}.${config.fileExtension}`)} already exists in ${violet(path.relative(cwd, selectedDir))}. Would you like to overwrite?`,
               initial: false,
            })

            if (!overwrite) {
               logger.info(
                  `Skipped ${chalk.cyan(`${fileName}.${config.fileExtension}`)}. To overwrite, run with the ${chalk.green(
                     '--overwrite',
                  )} flag.`,
               )
               return
            }
         }

         // Check if the component already exists in other directories
         const existingPaths = [baseDir, ...subDirs.map(dir => path.resolve(baseDir, dir))]
            .map(dir => path.resolve(dir, `${fileName}.${config.fileExtension}`))
            .filter(filePath => existsSync(filePath) && filePath !== path.resolve(selectedDir, `${fileName}.${config.fileExtension}`))
            .map(filePath => path.relative(cwd, filePath))

         if (existingPaths.length > 0) {
            const { confirmCreation } = await prompts({
               type: 'confirm',
               name: 'confirmCreation',
               message: `A component named ${chalk.cyan(`${fileName}.${config.fileExtension}`)} already exists in the following directories:\n${existingPaths.map(p => violet(p)).join('\n')}\nDo you still want to create it in ${violet(path.relative(cwd, selectedDir))}?`,
               initial: true,
            })

            if (!confirmCreation) {
               logger.info(`Skipped creating ${chalk.cyan(`${fileName}.${config.fileExtension}`)} in ${violet(path.relative(cwd, selectedDir))}.`)
               return
            }
         }

         // Check if the target directory exists, if not, prompt to create it
         if (!existsSync(selectedDir)) {
            const { createDir } = await prompts({
               type: 'confirm',
               name: 'createDir',
               message: `The directory ${violet(path.relative(cwd, selectedDir))} does not exist. Would you like to create it?`,
               initial: true,
            })

            if (!createDir) {
               logger.warn(`Directory ${violet(path.relative(cwd, selectedDir))} does not exist. Exiting.`)
               process.exit(0)
            }

            await fs.mkdir(selectedDir, { recursive: true })
         }

         const spinner = ora(`Creating component...`).start()
         const content = COMPONENT.replace(/<%- componentName %>/g, functionName)
         await fs.writeFile(filePath, content)
         spinner.succeed(`Component ${chalk.cyan(`${fileName}.${config.fileExtension}`)} created successfully in ${violet(path.relative(cwd, selectedDir))}.`)
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
