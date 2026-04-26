import { describe, expect, it } from 'vitest'
import { PROMPT_VERSION, buildPrompt } from '../../src/translation/prompt.js'
import type { FileChunk, GlossaryEntry, TranslationRequest } from '../../src/translation/types.js'

const wholeFileChunk: FileChunk = {
  index: 0,
  source: '# Title\n\nSome paragraph with `code`.\n\n## Section\n\n- list item\n',
  sourceHash: 'x'.repeat(64),
  isFirst: true,
  isLast: true,
}

const middleChunk: FileChunk = {
  index: 1,
  source: '## Middle\n\nAnother paragraph.\n',
  sourceHash: 'y'.repeat(64),
  isFirst: false,
  isLast: false,
}

const glossary: GlossaryEntry[] = [{ source: 'agent', target: '智能体' }]

const makeReq = (chunk: FileChunk): TranslationRequest => ({
  chunk,
  upstreamPath: 'docs/index.md',
  glossaryEntries: glossary,
  projectId: 'gemini-cli',
  upstreamCommitSha: 'abcdef',
})

describe('buildPrompt (v2.0.0 file-level)', () => {
  it('exposes PROMPT_VERSION = "v2.0.0"', () => {
    expect(PROMPT_VERSION).toBe('v2.0.0')
  })

  it('describes a complete file when both isFirst and isLast', () => {
    const out = buildPrompt(makeReq(wholeFileChunk), glossary)
    expect(out).toContain('a complete Markdown file')
  })

  it('describes a middle section when neither isFirst nor isLast', () => {
    const out = buildPrompt(makeReq(middleChunk), glossary)
    expect(out).toContain('middle section of docs/index.md')
  })

  it('embeds the chunk source between [SOURCE] markers', () => {
    const out = buildPrompt(makeReq(wholeFileChunk), glossary)
    expect(out).toContain('[SOURCE]')
    expect(out).toContain('[END SOURCE]')
    expect(out).toContain(wholeFileChunk.source)
  })

  it('includes all 8 rules', () => {
    const out = buildPrompt(makeReq(wholeFileChunk), glossary)
    for (let n = 1; n <= 8; n++) {
      expect(out).toContain(`${n}.`)
    }
  })

  it('renders glossary entries in [GLOSSARY] section', () => {
    const out = buildPrompt(makeReq(wholeFileChunk), glossary)
    expect(out).toContain('- agent → 智能体')
  })

  it('explicitly forbids generating new anchors', () => {
    const out = buildPrompt(makeReq(wholeFileChunk), glossary)
    expect(out).toContain('Do NOT generate new anchors')
  })
})
