import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import prompts from 'prompts'
import { z } from 'zod'

import { logger } from '~/src/utils/logger'
import { handleError } from '~/src/utils/handle-error'
import { getProjectConfig } from '~/src/utils/get-project-info'
import {
   getConfig,
   rawConfigSchema,
   styles,
   DEFAULT_COMPONENTS,
   resolveConfigPaths
} from '~/src/utils/get-config'
import type { RawConfig } from '~/src/utils/get-config'

const initOptionsSchema = z.object({
   cwd: z.string(),
   yes: z.boolean(),
   defaults: z.boolean(),
})

export const init = new Command()
   .name('init')
   .description('initialize your project and install dependencies')
   .option('-y, --yes', 'skip confirmation prompt.', false)
   .option('-d, --defaults,', 'use default configuration.', false)
   .option(
      '-c, --cwd <cwd>',
      'the working directory. defaults to the current directory.',
      process.cwd(),
   )
   .action(async (opts) => {
      try {
         const options = initOptionsSchema.parse(opts)
         const cwd = path.resolve(options.cwd)

         // Ensure target directory exists.
         if (!existsSync(cwd)) {
            logger.error(`The path ${cwd} does not exist. Please try again.`)
            process.exit(1)
         }

         const projectConfig = await getProjectConfig(cwd)
         let config
         if (projectConfig) {
            config = await promptForMinimalConfig(
               cwd,
               projectConfig,
               opts.defaults,
            )
         } else {
            // Read config.
            const existingConfig = await getConfig(cwd)
            config = await promptForConfig(cwd, existingConfig, options.yes)
         }

         await runInit(cwd, config)

         logger.info('')
         logger.info(
            `${chalk.green(
               'Success!',
            )} Project initialization completed. You may now add components.`,
         )
         logger.info('')
      } catch (error) {
         handleError(error)
      }
   })

export async function promptForConfig(
   cwd: string,
   defaultConfig: RawConfig | null = null,
   skip = false,
) {
   const highlight = (text: string) => chalk.cyan(text)

   const options = await prompts([
      {
         type: 'select',
         name: 'style',
         message: `Which ${highlight('style')} would you like to use?`,
         choices: styles.map(style => ({
            title: style,
            value: style,
         })),
      },
      {
         type: 'text',
         name: 'componentsPath',
         message: `Configure the import alias for ${highlight('components')}:`,
         initial: defaultConfig?.componentsPath ?? DEFAULT_COMPONENTS,
      },
      {
         type: 'list',
         name: 'aliases',
         message: `Enter aliases for subdirectories (comma separated):`,
         initial: defaultConfig?.aliases?.join(', ') ?? '',
         separator: ',',
      },
      {
         type: 'confirm',
         name: 'tsx',
         message: `Are you using TypeScript?`,
         initial: true,
      },
   ])

   let fileExtension = 'tsx'
   if (!options.tsx) {
      const { extension } = await prompts({
         type: 'select',
         name: 'extension',
         message: 'Which file extension do you prefer for JavaScript files?',
         choices: [
            { title: 'js', value: 'js' },
            { title: 'jsx', value: 'jsx' },
         ],
      })
      fileExtension = extension
   }

   const config = rawConfigSchema.parse({
      style: options.style,
      componentsPath: options.componentsPath,
      tsx: options.tsx,
      aliases: options.aliases,
      fileExtension,
   })

   if (!skip) {
      const { proceed } = await prompts({
         type: 'confirm',
         name: 'proceed',
         message: `Write configuration to ${highlight(
        `genies.config.${fileExtension === 'tsx' ? 'ts' : 'js'}`
      )}. Proceed?`,
         initial: true,
      })

      if (!proceed)
         process.exit(0)
   }

   const resolvedConfig = await resolveConfigPaths(cwd, config)
   const configFileName = `genies.config.${resolvedConfig.fileExtension === 'tsx' ? 'ts' : 'js'}`

   // In Datei schreiben.
   logger.info('')
   const spinner = ora(`Writing ${configFileName}...`).start()
   const targetPath = path.resolve(cwd, configFileName)
   await fs.writeFile(targetPath, `export default ${JSON.stringify(config, null, 2)}`, 'utf8')
   spinner.succeed()

   return resolvedConfig
}

export async function promptForMinimalConfig(
   cwd: string,
   defaultConfig: any,
   defaults = false,
) {
   const highlight = (text: string) => chalk.cyan(text)
   let style = defaultConfig.style
   let tsx = defaultConfig.tsx
   let fileExtension = 'tsx'

   if (!defaults) {
      const options = await prompts([
         {
            type: 'select',
            name: 'style',
            message: `Which ${highlight('style')} would you like to use?`,
            choices: styles.map(style => ({
               title: style,
               value: style,
            })),
         },
         {
            type: 'confirm',
            name: 'tsx',
            message: `Are you using TypeScript?`,
            initial: true,
         },
      ])

      style = options.style
      tsx = options.tsx

      if (!tsx) {
         const { extension } = await prompts({
            type: 'select',
            name: 'extension',
            message: 'Which file extension do you prefer for JavaScript files?',
            choices: [
               { title: 'js', value: 'js' },
               { title: 'jsx', value: 'jsx' },
            ],
         })
         fileExtension = extension
      }
   }

   const config = rawConfigSchema.parse({
      style,
      componentsPath: defaultConfig.componentsPath,
      tsx,
      aliases: defaultConfig.aliases,
      fileExtension,
   })

   // Bestimmen, ob TypeScript oder JavaScript verwendet wird.
   const resolvedConfig = await resolveConfigPaths(cwd, config)
   const configFileName = `genies.config.${resolvedConfig.fileExtension === 'tsx' ? 'ts' : 'js'}`

   // In Datei schreiben.
   logger.info('')
   const spinner = ora(`Writing ${configFileName}...`).start()
   const targetPath = path.resolve(cwd, configFileName)
   await fs.writeFile(targetPath, `export default ${JSON.stringify(config, null, 2)}`, 'utf8')
   spinner.succeed()

   return resolvedConfig
}

export async function runInit(cwd: string, config: any) {
   const spinner = ora(`Initializing project...`)?.start()

   spinner?.succeed()
}
