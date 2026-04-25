#!/usr/bin/env tsx
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import pc from 'picocolors'
import { loadConfig } from '../src/config/loader.js'

const ROOT = process.cwd()
const DOCS = resolve(ROOT, 'docs')

interface CheckResult {
  name: string
  passed: boolean
  detail?: string
}

const checks: CheckResult[] = []

function record(name: string, passed: boolean, detail?: string): void {
  checks.push(detail !== undefined ? { name, passed, detail } : { name, passed })
}

function listMarkdown(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const abs = resolve(dir, name)
    if (statSync(abs).isDirectory()) {
      // Skip VitePress dist/cache + public assets — they aren't translated content.
      if (name === '.vitepress' || name === 'public') continue
      listMarkdown(abs, out)
    } else if (name.toLowerCase().endsWith('.md')) {
      out.push(abs)
    }
  }
  return out
}

function checkRootLicense(): void {
  const p = resolve(ROOT, 'LICENSE')
  if (!existsSync(p)) {
    record('root-LICENSE-exists', false, `missing: ${p}`)
    return
  }
  const txt = readFileSync(p, 'utf8')
  const isMit =
    /MIT License/i.test(txt) || /Permission is hereby granted, free of charge/i.test(txt)
  record('root-LICENSE-is-MIT', isMit)
}

function checkPackageJsonLicense(): void {
  const p = resolve(ROOT, 'package.json')
  if (!existsSync(p)) {
    record('package.json-license-MIT', false, 'package.json missing')
    return
  }
  const pkg = JSON.parse(readFileSync(p, 'utf8')) as { license?: string }
  record('package.json-license-MIT', pkg.license === 'MIT', `license=${pkg.license}`)
}

function checkHomepageDisclaimer(): void {
  const p = resolve(DOCS, 'index.md')
  if (!existsSync(p)) {
    record('homepage-disclaimer', false, 'docs/index.md missing')
    return
  }
  const html = readFileSync(p, 'utf8')
  const ok = html.includes('社区中文翻译') && html.includes('非官方')
  record('homepage-disclaimer', ok)
}

function checkProjectAssets(projectId: string): void {
  const dir = resolve(DOCS, projectId)
  if (!existsSync(dir)) {
    record(`${projectId}-docs-exist`, false, `${dir} missing — run \`pnpm sync\``)
    return
  }
  const files = listMarkdown(dir)
  if (files.length === 0) {
    record(`${projectId}-docs-non-empty`, false)
    return
  }
  record(`${projectId}-docs-non-empty`, true, `${files.length} file(s)`)

  // Every translated file must end with the attribution footer.
  let missing = 0
  for (const f of files) {
    const txt = readFileSync(f, 'utf8')
    if (!/本页译自/.test(txt) || !/社区翻译，非官方内容/.test(txt)) missing++
  }
  record(
    `${projectId}-attribution-footer-on-every-page`,
    missing === 0,
    missing === 0 ? undefined : `${missing} file(s) missing footer`,
  )

  // Project landing page must have the warning custom block.
  const landing = resolve(dir, 'index.md')
  if (existsSync(landing)) {
    const t = readFileSync(landing, 'utf8')
    record(`${projectId}-landing-warning-block`, t.includes('::: warning 非官方翻译'))
  }

  // Mirrored upstream LICENSE must exist.
  const lic = resolve(DOCS, 'public', 'licenses', projectId, 'LICENSE.txt')
  record(`${projectId}-upstream-LICENSE-mirrored`, existsSync(lic), lic)
}

function checkNoUpstreamLogos(): void {
  // Heuristic: scan docs/public/ for any image-named file that mentions the
  // forbidden brand names (gemini, openai, google, codex, chatgpt) — it could
  // legitimately be a third-party asset, but in practice we don't ship any.
  const pubDir = resolve(DOCS, 'public')
  if (!existsSync(pubDir)) {
    record('no-upstream-logos', true, 'docs/public absent')
    return
  }
  const offenders: string[] = []
  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const abs = resolve(dir, name)
      if (statSync(abs).isDirectory()) {
        if (name === 'licenses') continue
        walk(abs)
        continue
      }
      const lower = name.toLowerCase()
      const isImage = /\.(png|jpg|jpeg|svg|webp|gif)$/.test(lower)
      if (!isImage) continue
      if (/gemini|openai|chatgpt|codex|google/.test(lower)) {
        offenders.push(abs.replace(ROOT + sep, ''))
      }
    }
  }
  walk(pubDir)
  record(
    'no-upstream-logos',
    offenders.length === 0,
    offenders.length === 0 ? undefined : offenders.join(', '),
  )
}

function main(): void {
  const config = loadConfig()
  checkRootLicense()
  checkPackageJsonLicense()
  checkHomepageDisclaimer()
  for (const p of config.projects.projects) checkProjectAssets(p.id)
  checkNoUpstreamLogos()

  let failed = 0
  for (const c of checks) {
    const tag = c.passed ? pc.green('PASS') : pc.red('FAIL')
    const detail = c.detail ? pc.dim(`  (${c.detail})`) : ''
    console.log(`[${tag}] ${c.name}${detail}`)
    if (!c.passed) failed++
  }
  if (failed > 0) {
    console.log(pc.red(`\n✗ predeploy check FAILED — ${failed} issue(s)`))
    process.exit(1)
  }
  console.log(pc.green('\n✓ predeploy check passed'))
}

main()
