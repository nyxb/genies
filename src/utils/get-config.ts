import { cosmiconfig } from 'cosmiconfig'
import { z } from 'zod'
import { loadConfig } from 'tsconfig-paths'
import { resolveImport } from '~/src/utils/resolve-import'

export const DEFAULT_STYLE = 'kebab-case'
export const DEFAULT_COMPONENTS = '~/components'
export const styles = ['camelCase', 'kebab-case', 'snake_case', 'StartCase'] as const

const explorer = cosmiconfig('genies', {
   searchPlaces: [
      'package.json',
      '.genies',
      '.genies.json',
      '.genies.yaml',
      '.genies.yml',
      '.genies.js',
      '.genies.ts',
      '.genies.mjs',
      '.genies.cjs',
      'genies.config.js',
      'genies.config.ts',
      'genies.config.mjs',
      'genies.config.cjs',
      'genies.json'
   ],
})

export type RawConfig = z.infer<typeof rawConfigSchema>

export const rawConfigSchema = z
   .object({
      componentsPath: z.string().default(DEFAULT_COMPONENTS),
      style: z.enum(styles).default(DEFAULT_STYLE),
      tsx: z.boolean().default(true),
   })
   .strict()


export async function getConfig(cwd: string): Promise<RawConfig | null> {
   try {
      const configResult = await explorer.search(cwd)

      if (!configResult)
         return null

      return rawConfigSchema.parse(configResult.config)
   }
   catch (error) {
      throw new Error(`Invalid configuration found in ${cwd}`)
   }
}

export async function resolveConfigPaths(cwd: string, config: RawConfig) {
   // Read tsconfig.json.
   const tsConfig = await loadConfig(cwd)

   if (tsConfig.resultType === 'failed') {
      throw new Error(
      `Failed to load ${config.tsx ? 'tsconfig' : 'jsconfig'}.json. ${
        tsConfig.message ?? ''
      }`.trim(),
      )
   }

   const resolvedPaths = {
      components: await resolveImport(config.componentsPath, tsConfig),
   }

   return {
      ...config,
      resolvedPaths,
   }
}
