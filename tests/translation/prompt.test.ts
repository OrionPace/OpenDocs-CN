import { describe, expect, it } from 'vitest'
import { PROMPT_VERSION, buildPrompt } from '../../src/translation/prompt.js'
import type { Block, GlossaryEntry, TranslationRequest } from '../../src/translation/types.js'

const headingBlock: Block = {
  id: 'abc123',
  type: 'heading',
  source: '## Installation',
  sourceHash: 'x'.repeat(64),
  translatable: true,
  anchorHint: 'installation',
  headingLevel: 2,
  documentTitle: 'Getting Started',
  sectionTitle: 'Installation',
  prevBlockSource: 'Welcome.',
  nextBlockSource: 'Install via npm.',
}

const paragraphBlock: Block = {
  ...headingBlock,
  type: 'paragraph',
  source: 'Run `npm install` to get started.',
  anchorHint: undefined,
  headingLevel: undefined,
}

const glossary: GlossaryEntry[] = [{ source: 'agent', target: '智能体' }]

const makeReq = (block: Block): TranslationRequest => ({
  block,
  glossaryEntries: glossary,
  projectId: 'gemini-cli',
  upstreamCommitSha: 'abcdef',
})

describe('buildPrompt', () => {
  it('exposes PROMPT_VERSION = "v1.0.0"', () => {
    expect(PROMPT_VERSION).toBe('v1.0.0')
  })

  it('wraps PREVIOUS/NEXT blocks with CONTEXT ONLY markers', () => {
    const out = buildPrompt(makeReq(headingBlock), glossary)
    expect(out).toContain('[PREVIOUS BLOCK — CONTEXT ONLY, DO NOT TRANSLATE OR OUTPUT]')
    expect(out).toContain('[NEXT BLOCK — CONTEXT ONLY, DO NOT TRANSLATE OR OUTPUT]')
  })

  it('includes all 8 rules', () => {
    const out = buildPrompt(makeReq(headingBlock), glossary)
    for (let n = 1; n <= 8; n++) {
      expect(out).toContain(`${n}.`)
    }
  })

  it('renders the anchor hint for heading blocks', () => {
    const out = buildPrompt(makeReq(headingBlock), glossary)
    expect(out).toContain('{#installation}')
  })

  it('shows "(not a heading)" for non-heading blocks', () => {
    const out = buildPrompt(makeReq(paragraphBlock), glossary)
    expect(out).toContain('(not a heading)')
  })

  it('renders the glossary entries in the [GLOSSARY] section', () => {
    const out = buildPrompt(makeReq(paragraphBlock), glossary)
    expect(out).toContain('- agent → 智能体')
  })

  it('embeds the block source in the TRANSLATE THIS BLOCK section', () => {
    const out = buildPrompt(makeReq(paragraphBlock), glossary)
    expect(out).toContain('Run `npm install` to get started.')
  })
})
