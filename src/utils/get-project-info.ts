import { existsSync } from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import fs, { pathExists } from 'fs-extra'
import { loadConfig } from 'tsconfig-paths'
import { getConfig } from '~/src/utils/get-config'
import type { RawConfig } from '~/src/utils/get-config'
import prompts from 'prompts';
import { rawConfigSchema, DEFAULT_COMPONENTS, styles } from '~/src/utils/get-config';

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

export async function getProjectInfo(cwd: string) {
   const info = {
      tsconfig: null,
      srcDir: false,
      appDir: false,
      isTsx: null,
   }

   try {
      const tsconfig = await getTsConfig(cwd)

      return {
         tsconfig,
         srcDir: existsSync(path.resolve(cwd, 'src')),
         appDir:
            existsSync(path.resolve(cwd, 'app')) ||
            existsSync(path.resolve(cwd, 'src/app')),
         isTsx: tsconfig !== null,
      }
   }
   catch (error) {
      return info
   }
}

export async function getTsConfig(cwd: string) {
   try {
      const tsconfigPath = path.join(cwd, 'tsconfig.json')
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

   const projectInfo = await getProjectInfo(cwd);
   const { isTsx } = projectInfo;

   const { componentsPath, aliases, useTsx } = await prompts([
     {
       type: 'text',
       name: 'componentsPath',
       message: `Enter the path for your components directory:`,
       initial: DEFAULT_COMPONENTS,
     },
     {
       type: 'list',
       name: 'aliases',
       message: `Enter aliases for subdirectories (comma separated):`,
       initial: '',
       separator: ',',
     },
     {
       type: 'confirm',
       name: 'useTsx',
       message: `Are you using TypeScript?`,
       initial: isTsx !== null ? isTsx : true,
     },
   ]);

   const config: RawConfig = {
     componentsPath: path.resolve(cwd, componentsPath),
     style: 'kebab-case',
     tsx: useTsx,
     aliases: aliases.map(alias => alias.trim()),
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

export async function preFlight(cwd: string) {
   // We need Tailwind CSS to be configured.
   const tailwindConfig = await fg.glob('tailwind.config.*', {
      cwd,
      deep: 3,
      ignore: PROJECT_SHARED_IGNORE,
   })

   if (!tailwindConfig.length) {
      throw new Error(
