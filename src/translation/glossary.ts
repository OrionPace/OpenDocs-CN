import { createHash } from 'node:crypto'
import type { GlossaryEntry } from './types.js'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Return the glossary entries whose `source` term appears in the given block.
 * Matching is word-boundary; case-insensitive unless entry.caseSensitive=true.
 *
 * "agent" in "the agent runs" → match.
 * "agent" in "the reagent runs" → no match (word boundary).
 */
export function matchGlossary(source: string, glossary: readonly GlossaryEntry[]): GlossaryEntry[] {
  const matched: GlossaryEntry[] = []
  for (const entry of glossary) {
    const flags = entry.caseSensitive ? '' : 'i'
    const re = new RegExp(`\\b${escapeRegex(entry.source)}\\b`, flags)
    if (re.test(source)) matched.push(entry)
  }
  return matched
}

/**
 * Hash derived from the sorted target strings of the applicable glossary
 * entries. Part of the cache-key triple. A change in any entry's target —
 * or the set of applicable entries — invalidates the cache for that block.
 */
export function computeGlossaryHash(entries: readonly GlossaryEntry[]): string {
  const targets = entries.map((e) => `${e.source}=>${e.target}`).sort()
  return createHash('sha256').update(JSON.stringify(targets)).digest('hex')
}

/**
 * Render matched entries as the YAML fragment that goes into the prompt's
 * [GLOSSARY] section. Example:
 *   - agent → 智能体 (note: fixed term in agent tooling; do not use 代理)
 *   - sandbox → 沙箱
 */
export function renderGlossaryYaml(entries: readonly GlossaryEntry[]): string {
  if (entries.length === 0) return '(no glossary entries applicable to this block)'
  const lines = entries.map((e) => {
    const note = e.note ? ` (note: ${e.note})` : ''
    return `- ${e.source} → ${e.target}${note}`
  })
  return lines.join('\n')
}
