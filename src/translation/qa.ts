import type { Block, GlossaryEntry } from './types.js'

export interface QAFailure {
  check: string
  details: string
}

export interface QAOutcome {
  passed: boolean
  failures: QAFailure[]
  /** Translated text after deterministic repairs (currently: code-fence restore). */
  repairedText: string
}

const CODE_FENCE_RE = /```[\s\S]*?```/gm
const INLINE_CODE_RE = /`[^`\n]+`/g
const URL_RE = /https?:\/\/[^\s)]+/g
const LINK_RE = /\[[^\]]+\]\([^)]+\)/g
const HEADING_LINE_RE = /^(#{1,6})\s+/gm
const ANCHOR_RE = /\{#[a-zA-Z0-9_-]+\}/

function count(re: RegExp, s: string): number {
  return (s.match(re) || []).length
}

function stripFences(s: string): string {
  return s.replace(CODE_FENCE_RE, '')
}

function extractFences(s: string): string[] {
  return s.match(CODE_FENCE_RE) ?? []
}

function countHeadingsByLevel(s: string): Record<number, number> {
  const counts: Record<number, number> = {}
  const matches = s.match(HEADING_LINE_RE) ?? []
  for (const m of matches) {
    const level = m.trimEnd().length - 1 // "## " → length 3, level 2
    // safer: count the '#'s
    const hashCount = (m.match(/#/g) ?? []).length
    counts[hashCount] = (counts[hashCount] ?? 0) + 1
    void level
  }
  return counts
}

/**
 * Deterministic repair: if the LLM altered code-fence content but the number
 * of fences is unchanged, restore each fence from the source. This is NOT a
 * retry — code fences must always be byte-identical to source.
 */
function restoreCodeFences(source: string, translated: string): string {
  const src = extractFences(source)
  const dst = extractFences(translated)
  if (src.length === 0 || src.length !== dst.length) return translated

  let out = ''
  let cursor = 0
  for (let i = 0; i < dst.length; i++) {
    const needle = dst[i]!
    const idx = translated.indexOf(needle, cursor)
    if (idx < 0) return translated // should not happen
    out += translated.slice(cursor, idx) + src[i]!
    cursor = idx + needle.length
  }
  out += translated.slice(cursor)
  return out
}

/**
 * Run all structural checks on a translated block. Returns the possibly
 * repaired translated text plus a list of remaining (unrepaired) failures.
 */
export function runQA(
  block: Block,
  translated: string,
  glossaryEntries: readonly GlossaryEntry[],
): QAOutcome {
  const source = block.source
  const failures: QAFailure[] = []

  // Always attempt the repair first. Any remaining checks run on the repaired text.
  const repairedText = restoreCodeFences(source, translated)

  // 1. empty output
  if (repairedText.trim().length === 0) {
    failures.push({ check: 'emptyOutput', details: 'translated text is empty' })
    return { passed: false, failures, repairedText }
  }

  // 2. code fence count
  const srcFences = count(CODE_FENCE_RE, source)
  const dstFences = count(CODE_FENCE_RE, repairedText)
  if (srcFences !== dstFences) {
    failures.push({
      check: 'codeFenceCount',
      details: `source=${srcFences}, translated=${dstFences}`,
    })
  }

  // 3. inline code count (excluding fenced regions)
  const srcInline = count(INLINE_CODE_RE, stripFences(source))
  const dstInline = count(INLINE_CODE_RE, stripFences(repairedText))
  if (srcInline !== dstInline) {
    failures.push({
      check: 'inlineCodeCount',
      details: `source=${srcInline}, translated=${dstInline}`,
    })
  }

  // 4. URL count
  const srcUrls = count(URL_RE, source)
  const dstUrls = count(URL_RE, repairedText)
  if (srcUrls !== dstUrls) {
    failures.push({ check: 'urlCount', details: `source=${srcUrls}, translated=${dstUrls}` })
  }

  // 5. link count
  const srcLinks = count(LINK_RE, source)
  const dstLinks = count(LINK_RE, repairedText)
  if (srcLinks !== dstLinks) {
    failures.push({
      check: 'linkCount',
      details: `source=${srcLinks}, translated=${dstLinks}`,
    })
  }

  // 6. heading count per level
  const srcHeadings = countHeadingsByLevel(source)
  const dstHeadings = countHeadingsByLevel(repairedText)
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const s = srcHeadings[level] ?? 0
    const d = dstHeadings[level] ?? 0
    if (s !== d) {
      failures.push({
        check: 'headingCount',
        details: `level=${level}, source=${s}, translated=${d}`,
      })
    }
  }

  // 7. heading anchor present (only if the block is a heading)
  if (block.type === 'heading' && (block.anchorHint || block.customAnchor)) {
    if (!ANCHOR_RE.test(repairedText)) {
      failures.push({
        check: 'headingAnchor',
        details: `expected {#${block.customAnchor ?? block.anchorHint}} in translated heading`,
      })
    }
  }

  // 8. glossary compliance
  const violations: string[] = []
  for (const entry of glossaryEntries) {
    if (!repairedText.includes(entry.target)) {
      violations.push(`${entry.source}→${entry.target}`)
    }
  }
  if (violations.length > 0) {
    failures.push({
      check: 'glossaryTerms',
      details: `missing targets: ${violations.join(', ')}`,
    })
  }

  return { passed: failures.length === 0, failures, repairedText }
}
