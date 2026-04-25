#!/usr/bin/env tsx
import { Command } from 'commander'
import { config as loadDotenv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import pc from 'picocolors'
import { loadConfig } from '../src/config/loader.js'
import type { ProjectConfig, ProviderConfig } from '../src/config/schema.js'
import { syncProject, type RunSummary } from '../src/pipeline/runner.js'
import { TranslationMemory } from '../src/translation/memory.js'
import { DeepSeekProvider } from '../src/translation/providers/deepseek.js'
import type { TranslationProvider } from '../src/translation/providers/interface.js'
import { NvidiaNimProvider } from '../src/translation/providers/nvidia-nim.js'
import { OpenRouterProvider } from '../src/translation/providers/openrouter.js'

// Load .env.local explicitly — `dotenv/config` only handles `.env`.
const envFile = resolve(process.cwd(), '.env.local')
if (existsSync(envFile)) loadDotenv({ path: envFile })

function buildProvider(cfg: ProviderConfig): TranslationProvider | null {
  const apiKey = process.env[cfg.envKey]
  if (!apiKey) {
    if (cfg.optional) return null
    throw new Error(`Required env var ${cfg.envKey} is not set (provider: ${cfg.name})`)
  }
  const model = (cfg.modelEnvKey ? process.env[cfg.modelEnvKey] : undefined) ?? cfg.defaultModel
  if (cfg.name === 'deepseek') {
    return new DeepSeekProvider({ apiKey, model, baseUrl: cfg.baseUrl })
  }
  if (cfg.name === 'openrouter') {
    return new OpenRouterProvider({ apiKey, model, baseUrl: cfg.baseUrl })
  }
  if (cfg.name === 'nvidia-nim') {
    return new NvidiaNimProvider({ apiKey, model, baseUrl: cfg.baseUrl })
  }
  // Type-narrowed exhaustively above; this is unreachable but keeps TS strict.
  throw new Error(`Unknown provider: ${(cfg as { name: string }).name}`)
}

function printSummary(s: RunSummary): void {
  console.log(pc.bold(`\n[${s.projectId}] @ ${s.upstreamSha.slice(0, 7)}`))
  console.log(`  files scanned   : ${s.filesScanned}`)
  console.log(`  files changed   : ${s.filesChanged}`)
  console.log(`  files written   : ${s.filesTranslated}`)
  console.log(`  blocks LLM-call : ${s.blocksTranslated}`)
  console.log(`  cache hits      : ${s.cacheHits}`)
  if (s.failures > 0) {
    console.log(pc.red(`  failures        : ${s.failures}`))
  } else {
    console.log(`  failures        : 0`)
  }
}

async function main(): Promise<void> {
  const program = new Command()
  program
    .name('sync')
    .description('Sync upstream docs and translate to Simplified Chinese')
    .option('-p, --project <id>', 'sync a single project by id')
    .option('-f, --full', 'force re-translation, ignore cache', false)
    .option('-c, --concurrency <n>', 'blocks per file (parallel)', (v) => parseInt(v, 10))
    .parse(process.argv)

  const opts = program.opts<{ project?: string; full: boolean; concurrency?: number }>()

  const config = loadConfig()
  const providers = config.providers.providers
    .map(buildProvider)
    .filter((p): p is TranslationProvider => p !== null)

  if (providers.length === 0) {
    console.error(pc.red('No translation providers available — check .env.local'))
    process.exit(1)
  }
  console.log(pc.dim(`providers: ${providers.map((p) => `${p.name}(${p.model})`).join(' → ')}`))

  const allProjects: ProjectConfig[] = config.projects.projects
  const targets = opts.project ? allProjects.filter((p) => p.id === opts.project) : allProjects
  if (targets.length === 0) {
    console.error(pc.red(`No project matches id="${opts.project}"`))
    process.exit(1)
  }

  let totalFailures = 0
  for (const project of targets) {
    console.log(pc.cyan(`\n→ syncing ${project.id}`))
    const memory = new TranslationMemory(project.id)
    try {
      const summary = await syncProject(project, providers, memory, config.glossary.terms, {
        full: opts.full,
        ourRepo: config.projects.ourRepo,
        blocksPerFile: opts.concurrency ?? config.providers.concurrency.blocksPerFile,
        filesInParallel: config.providers.concurrency.filesInParallel,
      })
      printSummary(summary)
      totalFailures += summary.failures
    } finally {
      memory.close()
    }
  }

  if (totalFailures > 0) {
    console.log(
      pc.yellow(
        `\nFinished with ${totalFailures} block-level failure(s). See state/<id>.json#failedBlocks.`,
      ),
    )
    process.exit(2)
  }
  console.log(pc.green('\n✓ all projects synced'))
}

main().catch((err) => {
  console.error(pc.red('sync failed:'), err)
  process.exit(1)
})
