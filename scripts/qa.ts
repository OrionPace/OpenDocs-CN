#!/usr/bin/env tsx
import { Command } from 'commander'
import { config as loadDotenv } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pc from 'picocolors'
import { loadConfig } from '../src/config/loader.js'
import type { ProjectConfig } from '../src/config/schema.js'
import { fetchFileContent } from '../src/sync/github.js'
import { readState } from '../src/sync/state.js'
import { runFileQA } from '../src/translation/file-qa.js'
import { matchGlossary } from '../src/translation/glossary.js'
import type { GlossaryEntry, QAReport } from '../src/translation/types.js'

const envFile = resolve(process.cwd(), '.env.local')
if (existsSync(envFile)) loadDotenv({ path: envFile })

interface PerFileResult {
  file: string
  failures: number
  checks: { name: string; details?: string }[]
}

/**
 * Re-fetch each tracked upstream file and run runFileQA against the
 * locally-translated copy. Pure structural validation — no LLM calls.
 */
async function qaProject(
  project: ProjectConfig,
  glossary: readonly GlossaryEntry[],
  docsRoot: string,
): Promise<{ files: PerFileResult[]; report: QAReport }> {
  const state = readState(project.id)
  if (!state) {
    console.warn(pc.yellow(`No state for ${project.id} — run \`pnpm sync\` first.`))
    return {
      files: [],
      report: {
        generatedAt: new Date().toISOString(),
        overallPass: true,
        fileResults: [],
      },
    }
  }

  const fileResults: PerFileResult[] = []
  for (const tracked of state.files) {
    const upstream = await fetchFileContent(project, tracked.path)

    const docsAbsPath = resolve(
      docsRoot,
      project.id,
      tracked.path.startsWith(project.docsPath)
        ? tracked.path.slice(project.docsPath.length).replace(/^\/+/, '')
        : tracked.path,
    )
    if (!existsSync(docsAbsPath)) {
      fileResults.push({
        file: tracked.path,
        failures: 1,
        checks: [{ name: 'missingFile', details: docsAbsPath }],
      })
      continue
    }
    const translatedRaw = readFileSync(docsAbsPath, 'utf8')
    // Strip the attribution footer before structural comparison.
    const translated = translatedRaw.replace(/\n---\n>[\s\S]*$/, '\n')

    const applicable = matchGlossary(upstream, glossary)
    const out = runFileQA(upstream, translated, applicable)
    fileResults.push({
      file: tracked.path,
      failures: out.failures.length,
      checks: out.failures.map((f) => ({
        name: f.name,
        ...(f.details ? { details: f.details } : {}),
      })),
    })
  }

  const overallPass = fileResults.every((f) => f.failures === 0)
  return {
    files: fileResults,
    report: {
      generatedAt: new Date().toISOString(),
      overallPass,
      fileResults: fileResults.map((f) => ({
        filePath: f.file,
        passed: f.failures === 0,
        checks: f.checks.map((c) => ({
          name: c.name,
          passed: false,
          ...(c.details ? { details: c.details } : {}),
        })),
      })),
    },
  }
}

async function main(): Promise<void> {
  const program = new Command()
  program
    .name('qa')
    .description('Run structural QA on existing translated files (no LLM calls)')
    .option('-p, --project <id>', 'QA a single project')
    .option('-o, --out <path>', 'write JSON report to this path')
    .parse(process.argv)
  const opts = program.opts<{ project?: string; out?: string }>()

  const config = loadConfig()
  const docsRoot = resolve(process.cwd(), 'docs')
  const targets = opts.project
    ? config.projects.projects.filter((p) => p.id === opts.project)
    : config.projects.projects
  if (targets.length === 0) {
    console.error(pc.red(`No project matches id="${opts.project}"`))
    process.exit(1)
  }

  let totalFailures = 0
  const merged: QAReport = {
    generatedAt: new Date().toISOString(),
    overallPass: true,
    fileResults: [],
  }
  for (const project of targets) {
    console.log(pc.cyan(`\n→ qa ${project.id}`))
    const { files, report } = await qaProject(project, config.glossary.terms, docsRoot)
    for (const f of files) {
      const tag = f.failures === 0 ? pc.green('OK') : pc.red(`FAIL(${f.failures})`)
      console.log(`  [${tag}] ${f.file}`)
      for (const c of f.checks) {
        console.log(`        - ${c.name}: ${c.details ?? ''}`)
      }
      totalFailures += f.failures
    }
    merged.fileResults.push(...report.fileResults)
    if (!report.overallPass) merged.overallPass = false
  }

  if (opts.out) {
    mkdirSync(resolve(opts.out, '..'), { recursive: true })
    writeFileSync(opts.out, JSON.stringify(merged, null, 2) + '\n', 'utf8')
    console.log(pc.dim(`\nreport written to ${opts.out}`))
  }

  if (totalFailures > 0) {
    console.log(pc.red(`\n✗ QA failed: ${totalFailures} issue(s)`))
    process.exit(2)
  }
  console.log(pc.green('\n✓ QA passed'))
}

main().catch((err) => {
  console.error(pc.red('qa failed:'), err)
  process.exit(1)
})
