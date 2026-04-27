import type { GlossaryEntry, QACheck } from './types.js'

export interface FileQAOutcome {
  passed: boolean
  failures: QACheck[]
}

const FENCE_RE = /```[\s\S]*?```/gm
const INLINE_CODE_RE = /(?<!`)`[^`\n]+`(?!`)/g
const URL_RE = /https?:\/\/[^\s)<>"']+/g
const HEADING_RE = /^#{1,6} .+$/gm
const ANCHOR_ATTR_RE = /\{#[a-zA-Z0-9_-][^}]*\}/g

// HTML void elements that are legal without a closing tag
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const OPEN_TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(?<!\/|-)>/g
const CLOSE_TAG_RE = /<\/([a-zA-Z][a-zA-Z0-9-]*)>/g

function countHtmlTags(text: string): Map<string, { open: number; close: number }> {
  // Strip both fenced code blocks and inline code spans so that HTML-like
  // tokens inside code (e.g. `<crate>`) are not counted as real HTML tags.
  const stripped = text.replace(FENCE_RE, '').replace(INLINE_CODE_RE, '')
  const counts = new Map<string, { open: number; close: number }>()

  const get = (tag: string) => {
    const key = tag.toLowerCase()
    if (!counts.has(key)) counts.set(key, { open: 0, close: 0 })
    return counts.get(key)!
  }

  for (const m of stripped.matchAll(new RegExp(OPEN_TAG_RE.source, 'g'))) {
    const tag = m[1]!.toLowerCase()
    if (!VOID_ELEMENTS.has(tag)) get(tag).open++
  }
  for (const m of stripped.matchAll(new RegExp(CLOSE_TAG_RE.source, 'g'))) {
    get(m[1]!.toLowerCase()).close++
  }

  return counts
}

/**
 * Deterministically repair HTML tag imbalance by appending missing closing tags.
 * Handles upstream source bugs (e.g. a missing </details>) that would otherwise
 * break VitePress/Vue compilation even when using the English source fallback.
 */
export function repairHtmlBalance(text: string): string {
  const counts = countHtmlTags(text)
  let result = text
  for (const [tag, { open, close }] of counts) {
    const deficit = open - close
    if (deficit > 0) {
      result += ('\n' + `</${tag}>`).repeat(deficit)
    }
  }
  return result
}

function count(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Run structural QA on a translated file (or chunk) against its source.
 * Returns the list of failed checks. None of these checks make LLM calls.
 *
 * Checks:
 *   - non-empty output
 *   - same fenced-code-block count
 *   - same inline-code count (allow ±10% to tolerate minor LLM variation)
 *   - same URL count
 *   - same heading count
 *   - same `{#anchor}` attribute count
 *   - every glossary source term in the source has its target in the output
 */
export function runFileQA(
  source: string,
  translated: string,
  glossary: readonly GlossaryEntry[],
): FileQAOutcome {
  const failures: QACheck[] = []

  if (!translated.trim()) {
    failures.push({ name: 'nonEmpty', passed: false, details: 'translated output is empty' })
    return { passed: false, failures }
  }

  const srcFences = count(source, FENCE_RE)
  const trFences = count(translated, FENCE_RE)
  if (srcFences !== trFences) {
    failures.push({
      name: 'codeFenceCount',
      passed: false,
      details: `source=${srcFences} translated=${trFences}`,
    })
  }

  const srcInline = count(source, INLINE_CODE_RE)
  const trInline = count(translated, INLINE_CODE_RE)
  if (Math.abs(srcInline - trInline) > Math.max(2, Math.ceil(srcInline * 0.1))) {
    failures.push({
      name: 'inlineCodeCount',
      passed: false,
      details: `source=${srcInline} translated=${trInline}`,
    })
  }

  const srcUrls = count(source, URL_RE)
  const trUrls = count(translated, URL_RE)
  if (srcUrls !== trUrls) {
    failures.push({
      name: 'urlCount',
      passed: false,
      details: `source=${srcUrls} translated=${trUrls}`,
    })
  }

  const srcHeadings = count(source, HEADING_RE)
  const trHeadings = count(translated, HEADING_RE)
  if (srcHeadings !== trHeadings) {
    failures.push({
      name: 'headingCount',
      passed: false,
      details: `source=${srcHeadings} translated=${trHeadings}`,
    })
  }

  const srcAnchors = count(source, ANCHOR_ATTR_RE)
  const trAnchors = count(translated, ANCHOR_ATTR_RE)
  if (srcAnchors !== trAnchors) {
    failures.push({
      name: 'anchorAttrCount',
      passed: false,
      details: `source=${srcAnchors} translated=${trAnchors}`,
    })
  }

  // HTML tag balance: detect unclosed tags that would break VitePress/Vue build.
  // Only fail when source is balanced but translation is not — if source itself
  // is unbalanced, that is an upstream problem, not a translation error.
  const srcTags = countHtmlTags(source)
  const trTags = countHtmlTags(translated)
  const allTagNames = new Set([...srcTags.keys(), ...trTags.keys()])
  for (const tag of allTagNames) {
    const src = srcTags.get(tag) ?? { open: 0, close: 0 }
    const tr = trTags.get(tag) ?? { open: 0, close: 0 }
    const srcBalanced = src.open === src.close
    const trBalanced = tr.open === tr.close
    if (srcBalanced && !trBalanced) {
      failures.push({
        name: 'htmlTagBalance',
        passed: false,
        details: `tag=${tag} source_open=${src.open} source_close=${src.close} translated_open=${tr.open} translated_close=${tr.close}`,
      })
    }
  }

  // Glossary enforcement: every applicable source term must have its target in
  // the translation. Skip terms whose target equals their source (no-op terms
  // like "MCP → MCP").
  for (const term of glossary) {
    const flags = term.caseSensitive ? '' : 'i'
    const srcRe = new RegExp(`\\b${escapeRegex(term.source)}\\b`, flags)
    if (!srcRe.test(source)) continue
    if (term.target === term.source) continue
    if (!translated.includes(term.target)) {
      failures.push({
        name: 'glossaryTerm',
        passed: false,
        details: `missing target "${term.target}" for source "${term.source}"`,
      })
    }
  }

  return { passed: failures.length === 0, failures }
}
