import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import {
  GlossaryFileSchema,
  ProjectsFileSchema,
  ProvidersFileSchema,
  type Config,
} from './schema.js'

const CONFIG_DIR = resolve(process.cwd(), 'config')

function loadYaml<T>(filename: string, schema: { parse: (v: unknown) => T }): T {
  const filepath = resolve(CONFIG_DIR, filename)
  let raw: string
  try {
    raw = readFileSync(filepath, 'utf8')
  } catch (err) {
    throw new Error(`Failed to read config file ${filepath}: ${(err as Error).message}`)
  }

  let parsed: unknown
  try {
    parsed = parseYaml(raw)
  } catch (err) {
    throw new Error(`Failed to parse YAML in ${filepath}: ${(err as Error).message}`)
  }

  try {
    return schema.parse(parsed)
  } catch (err) {
    throw new Error(`Invalid config in ${filepath}:\n${(err as Error).message}`)
  }
}

export function loadConfig(): Config {
  return {
    projects: loadYaml('projects.yaml', ProjectsFileSchema),
    providers: loadYaml('providers.yml', ProvidersFileSchema),
    glossary: loadYaml('glossary.yml', GlossaryFileSchema),
  }
}
