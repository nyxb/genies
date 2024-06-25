#!/usr/bin/env node
import { Command } from 'commander'
import { getPackageInfo } from './utils/get-package-info'
import { add } from '~/src/commands/add'
import { init } from '~/src/commands/init'

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

async function main() {
   const packageInfo = await getPackageInfo()

   const program = new Command()
      .name('genies')
      .description('Add React components to your apps')
      .version(
         packageInfo.version || '1.0.0',
         '-v, --version',
         'display the version number',
      )

   program
      .addCommand(init)
      .addCommand(add)

   program.parse()
}

main()
