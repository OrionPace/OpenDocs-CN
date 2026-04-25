import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { translateBlock } from '../../src/translation/engine.js'
import { TranslationMemory } from '../../src/translation/memory.js'
import type {
  ProviderCallResult,
  TranslationProvider,
} from '../../src/translation/providers/interface.js'
import type { Block, TranslationRequest } from '../../src/translation/types.js'

class FakeProvider implements TranslationProvider {
  readonly name = 'fake'
  readonly model = 'fake-model'
  calls = 0
  constructor(private readonly handler: (prompt: string, call: number) => string) {}
  async translate(prompt: string, _maxTokens: number): Promise<ProviderCallResult> {
    this.calls++
    return {
      text: this.handler(prompt, this.calls),
      tokensInput: 10,
      tokensOutput: 10,
      model: this.model,
    }
  }
  async healthCheck() {
    return true
  }
}

const block: Block = {
  id: 'b1',
  type: 'paragraph',
  source: 'Hello, world.',
  sourceHash: 'a'.repeat(64),
  translatable: true,
  documentTitle: 'Doc',
  sectionTitle: '',
}

const req: TranslationRequest = {
  block,
  glossaryEntries: [],
  projectId: 'test-project',
  upstreamCommitSha: 'abc123',
}

describe('translateBlock', () => {
  let tmpCwd: string
  let origCwd: string
  let memory: TranslationMemory

  beforeEach(() => {
    origCwd = process.cwd()
    tmpCwd = mkdtempSync(join(tmpdir(), 'odc-engine-'))
    process.chdir(tmpCwd)
    memory = new TranslationMemory('test-project')
  })

  afterEach(() => {
    memory.close()
    process.chdir(origCwd)
    rmSync(tmpCwd, { recursive: true, force: true })
  })

  it('calls provider on first request then caches on second', async () => {
    const provider = new FakeProvider(() => '你好，世界。')
    const first = await translateBlock(req, [provider], memory)
    expect(first.status).toBe('ok')
    expect(first.cacheHit).toBe(false)
    expect(first.translated).toBe('你好，世界。')
    expect(provider.calls).toBe(1)

    const second = await translateBlock(req, [provider], memory)
    expect(second.cacheHit).toBe(true)
    expect(second.translated).toBe('你好，世界。')
    expect(provider.calls).toBe(1) // no additional call
  })

  it('returns source verbatim for non-translatable blocks', async () => {
    const codeBlock: Block = {
      ...block,
      type: 'code',
      source: '```bash\nnpm install\n```',
      translatable: false,
    }
    const provider = new FakeProvider(() => 'SHOULD NOT BE CALLED')
    const out = await translateBlock({ ...req, block: codeBlock }, [provider], memory)
    expect(out.translated).toBe(codeBlock.source)
    expect(provider.calls).toBe(0)
  })

  it('falls back to second provider when first produces QA failure twice', async () => {
    // First provider always returns junk (empty) → fails QA both times.
    const bad = new FakeProvider(() => '')
    const good = new FakeProvider(() => '你好，世界。')
    const out = await translateBlock(req, [bad, good], memory)
    expect(out.status).toBe('ok')
    expect(out.translated).toBe('你好，世界。')
    expect(out.providerUsed).toBe('fake')
    expect(bad.calls).toBe(2) // original + stricter retry
    expect(good.calls).toBe(1)
  })

  it('marks failed and returns source when every provider fails', async () => {
    const bad1 = new FakeProvider(() => '')
    const bad2 = new FakeProvider(() => '')
    const out = await translateBlock(req, [bad1, bad2], memory)
    expect(out.status).toBe('failed')
    expect(out.translated).toBe(block.source)
    expect(out.failReason).toBeDefined()
  })
})
