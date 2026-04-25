import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TranslationMemory } from '../../src/translation/memory.js'
import type { CacheKey } from '../../src/translation/types.js'

describe('TranslationMemory', () => {
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
    promptVersion: 'v1.0.0',
  }

  it('returns null before any set', () => {
    expect(mem.get(key)).toBeNull()
  })

  it('set then get returns the same translated text', () => {
    mem.set(key, {
      projectId: 'test-project',
      sourceText: 'Hello world.',
      translatedText: '你好，世界。',
      blockType: 'paragraph',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    })
    const got = mem.get(key)
    expect(got?.translatedText).toBe('你好，世界。')
    expect(got?.status).toBe('ok')
    expect(got?.reviewed).toBe(false)
  })

  it('different glossary_hash yields a cache miss (null)', () => {
    mem.set(key, {
      projectId: 'test-project',
      sourceText: 'Hello.',
      translatedText: '你好。',
      blockType: 'paragraph',
    })
    const diff: CacheKey = { ...key, glossaryHash: 'c'.repeat(64) }
    expect(mem.get(diff)).toBeNull()
  })

  it('different prompt_version yields a cache miss (null)', () => {
    mem.set(key, {
      projectId: 'test-project',
      sourceText: 'Hello.',
      translatedText: '你好。',
      blockType: 'paragraph',
    })
    const diff: CacheKey = { ...key, promptVersion: 'v2.0.0' }
    expect(mem.get(diff)).toBeNull()
  })

  it('markFailed sets status to failed; get still returns the record', () => {
    mem.set(key, {
      projectId: 'test-project',
      sourceText: 'Hello.',
      translatedText: '你好。',
      blockType: 'paragraph',
    })
    mem.markFailed(key, 'qa_failed')
    const got = mem.get(key)
    expect(got?.status).toBe('failed')
  })

  it('upsert updates existing record when reviewed=0', () => {
    mem.set(key, {
      projectId: 'test-project',
      sourceText: 'Hello.',
      translatedText: 'v1',
      blockType: 'paragraph',
    })
    mem.set(key, {
      projectId: 'test-project',
      sourceText: 'Hello.',
      translatedText: 'v2',
      blockType: 'paragraph',
    })
    expect(mem.get(key)?.translatedText).toBe('v2')
  })
})
