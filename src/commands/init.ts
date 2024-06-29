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
   DEFAULT_COMPONENTS,
   rawConfigSchema,
   styles,
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
         }
         else {
            config = await promptForConfig(cwd, null, options.yes)
         }

         await runInit(cwd, config)

         logger.info('')
         logger.info(
            `${chalk.green(
               'Success!',
            )} Project initialization completed. You may now add components.`,
         )
         logger.info('')
      }
      catch (error) {
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
         name: 'components',
         message: `Configure the import alias for ${highlight('components')}:`,
         initial: defaultConfig?.components ?? '~/components',
      },
      {
         type: 'list',
         name: 'aliases',
         message: `Enter aliases for subdirectories (comma separated):`,
         initial: defaultConfig?.aliases?.join(', ') ?? '',
         separator: ',',
      },
   ])

   let configFileExtension = 'mjs'
   let componentFileExtension = 'tsx'
   if (!defaultConfig?.tsx) {
      const { extension } = await prompts({
         type: 'select',
         name: 'extension',
         message: 'Which file extension do you prefer for JavaScript files?',
         choices: [
            { title: 'js', value: 'js' },
            { title: 'jsx', value: 'jsx' },
         ],
      })
      configFileExtension = 'cjs'
      componentFileExtension = extension
   }

   const config = rawConfigSchema.parse({
      style: options.style,
      components: options.components,
      tsx: defaultConfig?.tsx ?? true,
      aliases: options.aliases,
      fileExtension: componentFileExtension,
   })

   if (!skip) {
      const { proceed } = await prompts({
         type: 'confirm',
         name: 'proceed',
         message: `Write configuration to ${highlight(
            `genies.config.${configFileExtension}`,
         )}. Proceed?`,
         initial: true,
      })

      if (!proceed)
         process.exit(0)
   }

   const configFileName = `genies.config.${configFileExtension}`

   // In Datei schreiben.
   logger.info('')
   const spinner = ora(`Writing ${configFileName}...`).start()
   const targetPath = path.resolve(cwd, configFileName)
   await fs.writeFile(targetPath, `export default ${JSON.stringify(config, null, 2)}`, 'utf8')
   spinner.succeed()

   return config
}

export async function promptForMinimalConfig(
   cwd: string,
   defaultConfig: any,
   defaults = false,
) {
   const highlight = (text: string) => chalk.cyan(text)
   let style = defaultConfig.style
   const tsx = defaultConfig.tsx
   let configFileExtension = 'mjs'
   let componentFileExtension = 'tsx'

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
      ])

      style = options.style

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
         configFileExtension = 'cjs'
         componentFileExtension = extension
      }
   }

   const config = rawConfigSchema.parse({
      style,
      components: defaultConfig.components,
      tsx,
      aliases: defaultConfig.aliases,
      fileExtension: componentFileExtension,
   })

   const configFileName = `genies.config.${configFileExtension}`

   // In Datei schreiben.
   logger.info('')
   const spinner = ora(`Writing ${configFileName}...`).start()
   const targetPath = path.resolve(cwd, configFileName)
   await fs.writeFile(targetPath, `export default ${JSON.stringify(config, null, 2)}`, 'utf8')
   spinner.succeed()

   return config
}

export async function runInit(cwd: string, config: any) {
   const spinner = ora(`Initializing project in ${cwd}...`).start()

   // Hier kannst du die Konfiguration verwenden, um die Initialisierung durchzuführen.
   // Beispiel: Abhängigkeiten installieren, Verzeichnisse erstellen, etc.
   console.log('Configuration:', config)

   spinner.succeed()
}
