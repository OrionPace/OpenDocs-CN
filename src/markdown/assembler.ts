import type { Block } from '../translation/types.js'

const ANCHOR_RE = /\{#[a-zA-Z0-9_-]+\}/

export interface AssembledBlock {
  block: Block
  translated: string
}

/**
 * Stitch translated blocks back into a single Markdown file. Non-translatable
 * blocks are written byte-identical. For heading blocks, we ensure the
 * `{#anchor}` marker is present — deterministic safety net in case the LLM
 * dropped it despite the prompt instruction (QA also flags this, but the
 * assembler is the last line of defence before disk).
 */
export function assembleFile(parts: readonly AssembledBlock[]): string {
  const out: string[] = []
  for (const { block, translated } of parts) {
    if (!block.translatable) {
      out.push(block.source)
      continue
    }
    if (block.type === 'heading') {
      out.push(ensureHeadingAnchor(translated, block))
      continue
    }
    out.push(translated)
  }
  // Join with blank-line separators. Most Markdown blocks are blank-line
  // delimited; frontmatter, code fences, and headings all expect this too.
  return out.join('\n\n').replace(/\s+$/, '') + '\n'
}

function ensureHeadingAnchor(translated: string, block: Block): string {
  const anchor = block.customAnchor ?? block.anchorHint
  if (!anchor) return translated
  if (ANCHOR_RE.test(translated)) return translated
  return `${translated.replace(/\s+$/, '')} {#${anchor}}`
}
