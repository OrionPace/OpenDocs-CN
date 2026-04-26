import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { translateChunk } from '../../src/translation/engine.js'
import { TranslationMemory } from '../../src/translation/memory.js'
import type {
  ProviderCallResult,
  TranslationProvider,
} from '../../src/translation/providers/interface.js'
import type { FileChunk, TranslationRequest } from '../../src/translation/types.js'

class FakeProvider implements TranslationProvider {
  readonly name = 'fake'
  readonly model = 'fake-model'
  calls = 0
  constructor(private readonly handler: (prompt: string, call: number) => string) {}
  async translate(prompt: string, _maxTokens: number): Promise<ProviderCallResult> {
    this.calls++
    return {
      text: this.handler(prompt, this.calls),
      tokensInput: 100,
      tokensOutput: 100,
      model: this.model,
    }
  }
  async healthCheck() {
    return true
  }
}

const sourceMd = '# Hello\n\nWorld text without code.\n'
const goodTranslation = '# 你好\n\n世界文本，没有代码。\n'

const chunk: FileChunk = {
  index: 0,
  source: sourceMd,
  sourceHash: 'a'.repeat(64),
  isFirst: true,
  isLast: true,
}

const req: TranslationRequest = {
  chunk,
  upstreamPath: 'docs/index.md',
  glossaryEntries: [],
  projectId: 'test-project',
  upstreamCommitSha: 'abc123',
}

describe('translateChunk', () => {
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
    const provider = new FakeProvider(() => goodTranslation)
    const first = await translateChunk(req, [provider], memory)
    expect(first.status).toBe('ok')
    expect(first.cacheHit).toBe(false)
    expect(first.translated).toBe(goodTranslation)
    expect(provider.calls).toBe(1)

    const second = await translateChunk(req, [provider], memory)
    expect(second.cacheHit).toBe(true)
    expect(second.translated).toBe(goodTranslation)
    expect(provider.calls).toBe(1)
  })

  it('falls back to second provider when first fails QA twice', async () => {
    const bad = new FakeProvider(() => '') // empty → fails nonEmpty
    const good = new FakeProvider(() => goodTranslation)
    const out = await translateChunk(req, [bad, good], memory)
    expect(out.status).toBe('ok')
    expect(out.translated).toBe(goodTranslation)
    expect(bad.calls).toBe(2) // original + stricter retry
    expect(good.calls).toBe(1)
  })

  it('marks failed and returns source placeholder when every provider fails', async () => {
    const bad1 = new FakeProvider(() => '')
    const bad2 = new FakeProvider(() => '')
    const out = await translateChunk(req, [bad1, bad2], memory)
    expect(out.status).toBe('failed')
    expect(out.translated).toBe(chunk.source)
    expect(out.failReason).toBeDefined()
  })
})
