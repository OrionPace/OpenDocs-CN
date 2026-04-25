import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildAttributionFooter, writeTranslatedFile } from '../../src/pipeline/writer.js'
import type { ProjectConfig } from '../../src/config/schema.js'

const project: ProjectConfig = {
  id: 'gemini-cli',
  name: 'Gemini CLI',
  owner: 'google-gemini',
  repo: 'gemini-cli',
  branch: 'main',
  docsPath: 'docs/',
  route: '/gemini-cli/',
  upstreamUrl: 'https://github.com/google-gemini/gemini-cli',
  license: 'Apache License 2.0',
}

describe('buildAttributionFooter', () => {
  it('includes pinned commit link, license, and an issue link', () => {
    const footer = buildAttributionFooter({
      project,
      upstreamSha: 'a'.repeat(40),
      upstreamPath: 'docs/index.md',
      ourRepo: 'me/opendocs-cn',
    })
    expect(footer).toContain('---')
    expect(footer).toContain('aaaaaaa') // sha:short
    expect(footer).toContain(
      `/${project.owner}/${project.repo}/blob/${'a'.repeat(40)}/docs/index.md`,
    )
    expect(footer).toContain('Apache License 2.0')
    expect(footer).toContain('社区翻译，非官方内容')
    expect(footer).toContain('me/opendocs-cn/issues/new')
  })
})

describe('writeTranslatedFile', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'odc-write-'))
  })
  afterEach(() => rmSync(tmp, { recursive: true, force: true }))

  it('writes body + footer under <docsRoot>/<projectId>/<relativePath>', () => {
    const out = writeTranslatedFile({
      project,
      relativePath: 'guide/setup.md',
      body: '# 安装\n\n请运行 `npm install`。\n',
      upstreamSha: 'b'.repeat(40),
      upstreamPath: 'docs/guide/setup.md',
      ourRepo: 'me/opendocs-cn',
      docsRoot: tmp,
    })
    expect(out).toContain('gemini-cli')
    expect(out).toContain('setup.md')
    const content = readFileSync(out, 'utf8')
    expect(content).toContain('# 安装')
    expect(content).toContain('npm install')
    expect(content).toContain('社区翻译')
    expect(content.endsWith('\n')).toBe(true)
    // Subpages must NOT have the landing warning block.
    expect(content).not.toContain('::: warning 非官方翻译')
  })

  it('injects the non-official warning block for the project landing page', () => {
    const out = writeTranslatedFile({
      project,
      relativePath: 'index.md',
      body: '# Gemini CLI 中文文档\n\n欢迎。\n',
      upstreamSha: 'c'.repeat(40),
      upstreamPath: 'docs/index.md',
      ourRepo: 'me/opendocs-cn',
      docsRoot: tmp,
    })
    const content = readFileSync(out, 'utf8')
    expect(content.startsWith('::: warning 非官方翻译')).toBe(true)
    expect(content).toContain(project.upstreamUrl)
    expect(content).toContain('# Gemini CLI 中文文档')
  })
})
