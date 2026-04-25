import { describe, expect, it } from 'vitest'
import {
  computeGlossaryHash,
  matchGlossary,
  renderGlossaryYaml,
} from '../../src/translation/glossary.js'
import type { GlossaryEntry } from '../../src/translation/types.js'

const GLOSSARY: GlossaryEntry[] = [
  { source: 'agent', target: '智能体', note: 'fixed term' },
  { source: 'sandbox', target: '沙箱' },
  { source: 'tool use', target: '工具调用' },
  { source: 'MCP', target: 'MCP', caseSensitive: true },
]

describe('matchGlossary', () => {
  it('matches "agent" at word boundary, case-insensitive by default', () => {
    const matched = matchGlossary('The Agent runs commands.', GLOSSARY)
    expect(matched.map((e) => e.source)).toContain('agent')
  })

  it('does NOT match "agent" inside "reagent" (word boundary)', () => {
    const matched = matchGlossary('A reagent is added.', GLOSSARY)
    expect(matched.map((e) => e.source)).not.toContain('agent')
  })

  it('matches multi-word terms like "tool use"', () => {
    const matched = matchGlossary('Tool use is supported.', GLOSSARY)
    expect(matched.map((e) => e.source)).toContain('tool use')
  })

  it('respects caseSensitive: true on "MCP"', () => {
    expect(matchGlossary('mcp server', GLOSSARY).map((e) => e.source)).not.toContain('MCP')
    expect(matchGlossary('MCP server', GLOSSARY).map((e) => e.source)).toContain('MCP')
  })

  it('returns an empty array when no terms appear', () => {
    expect(matchGlossary('No relevant words here.', GLOSSARY)).toEqual([])
  })
})

describe('computeGlossaryHash', () => {
  it('is stable for the same input', () => {
    const a = computeGlossaryHash([GLOSSARY[0]!, GLOSSARY[1]!])
    const b = computeGlossaryHash([GLOSSARY[0]!, GLOSSARY[1]!])
    expect(a).toBe(b)
  })

  it('is order-independent', () => {
    const a = computeGlossaryHash([GLOSSARY[0]!, GLOSSARY[1]!])
    const b = computeGlossaryHash([GLOSSARY[1]!, GLOSSARY[0]!])
    expect(a).toBe(b)
  })

  it('changes when a target string changes', () => {
    const a = computeGlossaryHash([{ source: 'agent', target: '智能体' }])
    const b = computeGlossaryHash([{ source: 'agent', target: '代理' }])
    expect(a).not.toBe(b)
  })
})

describe('renderGlossaryYaml', () => {
  it('renders entries as "- source → target" with optional note', () => {
    const rendered = renderGlossaryYaml([GLOSSARY[0]!])
    expect(rendered).toBe('- agent → 智能体 (note: fixed term)')
  })

  it('renders a placeholder when no entries', () => {
    expect(renderGlossaryYaml([])).toMatch(/no glossary entries/)
  })
})
