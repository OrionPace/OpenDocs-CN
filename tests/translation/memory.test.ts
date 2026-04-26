import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TranslationMemory } from '../../src/translation/memory.js'
import type { CacheKey } from '../../src/translation/types.js'

describe('TranslationMemory (file-level v2.0.0)', () => {
  let tmpCwd: string
  let origCwd: string
  let mem: TranslationMemory

  beforeEach(() => {
    origCwd = process.cwd()
    tmpCwd = mkdtempSync(join(tmpdir(), 'odc-mem-'))
    process.chdir(tmpCwd)
    mem = new TranslationMemory('test-project')
  })

  afterEach(() => {
    mem.close()
    process.chdir(origCwd)
    rmSync(tmpCwd, { recursive: true, force: true })
  })

  const key: CacheKey = {
    sourceHash: 'a'.repeat(64),
    glossaryHash: 'b'.repeat(64),
    promptVersion: 'v2.0.0',
  }

  const baseInput = {
    projectId: 'test-project',
    upstreamPath: 'docs/index.md',
    chunkIndex: 0,
  }

  it('returns null before any set', () => {
    expect(mem.get(key)).toBeNull()
  })

  it('set then get returns the same translated text', () => {
    mem.set(key, {
      ...baseInput,
      sourceText: '# Hello\n\nWorld.',
      translatedText: '# 你好\n\n世界。',
      provider: 'nvidia-nim',
      model: 'deepseek-ai/deepseek-v4-flash',
    })
    const got = mem.get(key)
    expect(got?.translatedText).toBe('# 你好\n\n世界。')
    expect(got?.status).toBe('ok')
  })

  it('different glossary_hash yields a cache miss', () => {
    mem.set(key, {
      ...baseInput,
      sourceText: 'Hello.',
      translatedText: '你好。',
    })
    const diff: CacheKey = { ...key, glossaryHash: 'c'.repeat(64) }
    expect(mem.get(diff)).toBeNull()
  })

  it('different prompt_version yields a cache miss', () => {
    mem.set(key, {
      ...baseInput,
      sourceText: 'Hello.',
      translatedText: '你好。',
    })
    const diff: CacheKey = { ...key, promptVersion: 'v3.0.0' }
    expect(mem.get(diff)).toBeNull()
  })

  it('markFailed sets status to failed', () => {
    mem.set(key, {
      ...baseInput,
      sourceText: 'Hello.',
      translatedText: '你好。',
    })
    mem.markFailed(key)
    expect(mem.get(key)?.status).toBe('failed')
  })

  it('upsert updates existing record', () => {
    mem.set(key, { ...baseInput, sourceText: 'Hello.', translatedText: 'v1' })
    mem.set(key, { ...baseInput, sourceText: 'Hello.', translatedText: 'v2' })
    expect(mem.get(key)?.translatedText).toBe('v2')
  })
})
