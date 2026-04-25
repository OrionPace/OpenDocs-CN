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
    return { text: this.fn(prompt), tokensInput: 5, tokensOutput: 5, model: this.model }
  }
  async healthCheck() {
    return true
  }
}

// Translates by replacing a few well-known English phrases. Just enough to
// produce a non-empty translation that passes QA structural checks (same
// counts of code-fences, inline code, headings, etc).
function fakeTranslate(prompt: string): string {
  // Extract the [TRANSLATE THIS BLOCK] section's content.
  const m = prompt.match(/\[TRANSLATE THIS BLOCK\]\n([\s\S]*?)\n\[END BLOCK\]/)
  if (!m || !m[1]) return ''
  const src = m[1]
  return src
    .replace(/^# Gemini CLI$/m, '# Gemini CLI 中文文档 {#gemini-cli}')
    .replace(/^## Installation$/m, '## 安装 {#installation}')
    .replace(/Welcome to the Gemini CLI documentation\./, '欢迎阅读 Gemini CLI 文档。')
    .replace(/Run `npm install` to install the CLI\./, '运行 `npm install` 安装 CLI。')
}

describe('syncProject (integration)', () => {
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

  it('first run translates each block; second run with same SHA is a no-op (zero LLM calls)', async () => {
    const provider = new CountingProvider(fakeTranslate)
    const glossary: GlossaryEntry[] = []

    const memory1 = new TranslationMemory(project.id)
    const summary1 = await syncProject(project, [provider], memory1, glossary, {
      ourRepo: 'me/opendocs-cn',
      docsRoot: resolve(tmpCwd, 'docs'),
    })
    memory1.close()
    expect(summary1.filesTranslated).toBe(1)
    expect(provider.calls).toBeGreaterThan(0)
    const callsAfterFirst = provider.calls

    // Second run, same upstream SHA — sha-v1 unchanged, so the file is
    // skipped at the changed-file filter (no LLM calls at all).
    const memory2 = new TranslationMemory(project.id)
    const summary2 = await syncProject(project, [provider], memory2, glossary, {
      ourRepo: 'me/opendocs-cn',
      docsRoot: resolve(tmpCwd, 'docs'),
    })
    memory2.close()
    expect(summary2.filesChanged).toBe(0)
    expect(provider.calls).toBe(callsAfterFirst)
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

  it('changing the upstream blob sha re-fetches and re-translates that file', async () => {
    const provider = new CountingProvider(fakeTranslate)
    const memory1 = new TranslationMemory(project.id)
    await syncProject(project, [provider], memory1, [], {
      ourRepo: 'me/opendocs-cn',
      docsRoot: resolve(tmpCwd, 'docs'),
    })
    memory1.close()

    // Change the tree blob sha — the runner should treat the file as changed.
    // The body is unchanged, so all four blocks hit cache (zero LLM calls).
    vi.mocked(github.fetchFileTree).mockResolvedValueOnce([
      { path: 'docs/index.md', relativePath: 'index.md', sha: 'sha-v2' },
    ])
    const callsBefore = provider.calls

    const memory2 = new TranslationMemory(project.id)
    const summary = await syncProject(project, [provider], memory2, [], {
      ourRepo: 'me/opendocs-cn',
      docsRoot: resolve(tmpCwd, 'docs'),
    })
    memory2.close()
    expect(summary.filesChanged).toBe(1)
    expect(summary.cacheHits).toBeGreaterThan(0)
    // Body identical → cache hit on every block → no new LLM calls.
    expect(provider.calls).toBe(callsBefore)
  })
})
