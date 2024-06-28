import { existsSync } from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import fs, { pathExists } from 'fs-extra'
import { loadConfig } from 'tsconfig-paths'
import { getConfig } from '~/src/utils/get-config'
import type { RawConfig } from '~/src/utils/get-config'

// TODO: Add support for more frameworks.
// We'll start with Next.js for now.
const PROJECT_TYPES = [
   'next-app',
   'next-app-src',
   'next-pages',
   'next-pages-src',
] as const

type ProjectType = (typeof PROJECT_TYPES)[number]

const PROJECT_SHARED_IGNORE = [
   '**/node_modules/**',
   '.next',
   'public',
   'dist',
   'build',
]

export async function getProjectInfo() {
   const info = {
      tsconfig: null,
      srcDir: false,
      appDir: false,
      componentsDir: false,
   }

   try {
      const tsconfig = await getTsConfig()

      return {
         tsconfig,
         srcDir: existsSync(path.resolve('./src')),
         appDir:
            existsSync(path.resolve('./app')) ||
            existsSync(path.resolve('./src/app')),
         componentsDir: existsSync(path.resolve('./components')),
      }
   }
   catch (error) {
      return info
   }
}

export async function getTsConfig() {
   try {
      const tsconfigPath = path.join('tsconfig.json')
      const tsconfig = await fs.readJSON(tsconfigPath)

      if (!tsconfig)
         throw new Error('tsconfig.json is missing')

      return tsconfig
   }
   catch (error) {
      console.error(`Error loading tsconfig.json:`, error)
      return null
   }
}

export async function getProjectConfig(cwd: string): Promise<RawConfig | null> {
  // Check for existing component config.
  const existingConfig = await getConfig(cwd);
  if (existingConfig) return existingConfig;

  // Prompt the user for the components path if no config is found
  const { componentsPath } = await prompts({
    type: 'text',
    name: 'componentsPath',
    message: `Enter the path for your components directory:`,
    initial: DEFAULT_COMPONENTS,
  });

  const isTsx = await isTypeScriptProject(cwd);

  const config: RawConfig = {
    componentsPath: path.resolve(cwd, componentsPath),
    style: 'kebab-case',
    tsx: isTsx,
    aliases: [], // Hinzufügen der Aliase zur Konfiguration
  };

  return config;
}

export async function getProjectType(cwd: string): Promise<ProjectType | null> {
   const files = await fg.glob('**/*', {
      cwd,
      deep: 3,
      ignore: PROJECT_SHARED_IGNORE,
   })

   const isNextProject = files.find(file => file.startsWith('next.config.'))
   if (!isNextProject)
      return null

   const isUsingSrcDir = await fs.pathExists(path.resolve(cwd, 'src'))
   const isUsingAppDir = await fs.pathExists(
      path.resolve(cwd, `${isUsingSrcDir ? 'src/' : ''}app`),
   )

   if (isUsingAppDir)
      return isUsingSrcDir ? 'next-app-src' : 'next-app'

   return isUsingSrcDir ? 'next-pages-src' : 'next-pages'
}

export async function getTsConfigAliasPrefix(cwd: string) {
   const tsConfig = await loadConfig(cwd)

   if (tsConfig?.resultType === 'failed' || !tsConfig?.paths)
      return null

   // This assume that the first alias is the prefix.
   for (const [alias, paths] of Object.entries(tsConfig.paths)) {
      if (paths.includes('./*') || paths.includes('./src/*'))
         return alias.at(0)
   }

   return null
}

export async function isTypeScriptProject(cwd: string) {
   // Check if cwd has a tsconfig.json file.
   return pathExists(path.resolve(cwd, 'tsconfig.json'))
}
