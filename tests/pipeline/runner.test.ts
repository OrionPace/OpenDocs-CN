import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectConfig } from '../../src/config/schema.js'
import { syncProject } from '../../src/pipeline/runner.js'
import * as github from '../../src/sync/github.js'
import { TranslationMemory } from '../../src/translation/memory.js'
import type {
  ProviderCallResult,
  TranslationProvider,
} from '../../src/translation/providers/interface.js'
import type { GlossaryEntry } from '../../src/translation/types.js'

const project: ProjectConfig = {
  id: 'gemini-cli',
  name: 'Gemini CLI',
  owner: 'google-gemini',
  repo: 'gemini-cli',
  branch: 'main',
  docsPath: 'docs/',
  route: '/gemini-cli/',
  upstreamUrl: 'https://github.com/google-gemini/gemini-cli',
  license: 'Apache-2.0',
}

const SAMPLE = `# Gemini CLI

Welcome to the Gemini CLI documentation.

## Installation

Run \`npm install\` to install the CLI.

\`\`\`bash
npm install -g gemini
\`\`\`
`

class CountingProvider implements TranslationProvider {
  readonly name = 'fake'
  readonly model = 'fake-model'
  calls = 0
  constructor(private readonly fn: (prompt: string) => string) {}
  async translate(prompt: string, _maxTokens: number): Promise<ProviderCallResult> {
    this.calls++
    return { text: this.fn(prompt), tokensInput: 50, tokensOutput: 50, model: this.model }
  }
  async healthCheck() {
    return true
  }
}

/**
 * Pulls the file source out of the prompt's [SOURCE] block and produces a
 * structurally-identical translation: same headings, same code blocks, same
 * inline code, same URLs. This is what a competent LLM would produce.
 */
function fakeTranslate(prompt: string): string {
  const m = prompt.match(/\[SOURCE\]\n([\s\S]*?)\n\[END SOURCE\]/)
  if (!m || !m[1]) return ''
  return m[1]
    .replace(/^# Gemini CLI$/m, '# Gemini CLI 中文文档')
    .replace(/^## Installation$/m, '## 安装')
    .replace(/Welcome to the Gemini CLI documentation\./, '欢迎阅读 Gemini CLI 文档。')
    .replace(/Run `npm install` to install the CLI\./, '运行 `npm install` 安装 CLI。')
}

describe('syncProject (integration, file-level)', () => {
  let tmpCwd: string
  let origCwd: string

  beforeEach(() => {
    origCwd = process.cwd()
    tmpCwd = mkdtempSync(join(tmpdir(), 'odc-runner-'))
    process.chdir(tmpCwd)
    vi.spyOn(github, 'fetchBranchSha').mockResolvedValue('a'.repeat(40))
    vi.spyOn(github, 'fetchFileTree').mockResolvedValue([
      { path: 'docs/index.md', relativePath: 'index.md', sha: 'sha-v1' },
    ])
    vi.spyOn(github, 'fetchFileContent').mockResolvedValue(SAMPLE)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.chdir(origCwd)
    rmSync(tmpCwd, { recursive: true, force: true })
  })

  it('first run translates the file; second run hits cache (zero LLM calls)', async () => {
    const provider = new CountingProvider(fakeTranslate)
    const glossary: GlossaryEntry[] = []

    const memory1 = new TranslationMemory(project.id)
    const summary1 = await syncProject(project, [provider], memory1, glossary, {
      ourRepo: 'me/opendocs-cn',
      docsRoot: resolve(tmpCwd, 'docs'),
    })
    memory1.close()
    expect(summary1.filesTranslated).toBe(1)
    expect(provider.calls).toBe(1)

    // Second run, same content → file-hash cache hit, no LLM call.
    const memory2 = new TranslationMemory(project.id)
    const summary2 = await syncProject(project, [provider], memory2, glossary, {
      ourRepo: 'me/opendocs-cn',
      docsRoot: resolve(tmpCwd, 'docs'),
    })
    memory2.close()
    expect(summary2.filesCacheHit).toBe(1)
    expect(provider.calls).toBe(1) // no new call
  })

  it('attribution footer + landing-warning block are both present in landing page', async () => {
    const provider = new CountingProvider(fakeTranslate)
    const memory = new TranslationMemory(project.id)
    await syncProject(project, [provider], memory, [], {
      ourRepo: 'me/opendocs-cn',
      docsRoot: resolve(tmpCwd, 'docs'),
    })
    memory.close()
    const out = readFileSync(resolve(tmpCwd, 'docs', project.id, 'index.md'), 'utf8')
    expect(out.startsWith('::: warning 非官方翻译')).toBe(true)
    expect(out).toContain('本页译自')
    expect(out).toContain('社区翻译，非官方内容')
    // Code fence content must be byte-identical to source.
    expect(out).toContain('```bash\nnpm install -g gemini\n```')
  })

  it('always writes the file even when content already cached', async () => {
    const provider = new CountingProvider(fakeTranslate)
    const memory1 = new TranslationMemory(project.id)
    await syncProject(project, [provider], memory1, [], {
      ourRepo: 'me/opendocs-cn',
      docsRoot: resolve(tmpCwd, 'docs'),
    })
    memory1.close()

    // Wipe the docs output and run again — the runner should re-create it
    // from cache without any new LLM calls.
    rmSync(resolve(tmpCwd, 'docs', project.id), { recursive: true, force: true })
    const callsBefore = provider.calls

    const memory2 = new TranslationMemory(project.id)
    await syncProject(project, [provider], memory2, [], {
      ourRepo: 'me/opendocs-cn',
      docsRoot: resolve(tmpCwd, 'docs'),
    })
    memory2.close()

    expect(provider.calls).toBe(callsBefore)
    const out = readFileSync(resolve(tmpCwd, 'docs', project.id, 'index.md'), 'utf8')
    expect(out).toContain('# Gemini CLI 中文文档')
  })
})
