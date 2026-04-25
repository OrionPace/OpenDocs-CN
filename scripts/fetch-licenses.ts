#!/usr/bin/env tsx
import { config as loadDotenv } from 'dotenv'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pc from 'picocolors'
import { loadConfig } from '../src/config/loader.js'
import { fetchLicenseFiles } from '../src/sync/github.js'

const envFile = resolve(process.cwd(), '.env.local')
if (existsSync(envFile)) loadDotenv({ path: envFile })

/**
 * Mirror upstream LICENSE (and NOTICE if present) into
 * `docs/public/licenses/{projectId}/`. Run from CI before `vitepress build`
 * so the deployed site links to up-to-date copies.
 */
async function main(): Promise<void> {
  const config = loadConfig()
  const docsRoot = resolve(process.cwd(), 'docs')

  for (const project of config.projects.projects) {
    console.log(pc.cyan(`→ fetching licenses for ${project.id}`))
    const { license, notice } = await fetchLicenseFiles(project)
    const outDir = resolve(docsRoot, 'public', 'licenses', project.id)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, 'LICENSE.txt'), license, 'utf8')
    console.log(pc.dim(`  wrote ${outDir}/LICENSE.txt (${license.length} bytes)`))
    if (notice) {
      writeFileSync(resolve(outDir, 'NOTICE.txt'), notice, 'utf8')
      console.log(pc.dim(`  wrote ${outDir}/NOTICE.txt (${notice.length} bytes)`))
    }
  }
  console.log(pc.green('\n✓ licenses synced'))
}

main().catch((err) => {
  console.error(pc.red('fetch-licenses failed:'), err)
  process.exit(1)
})
