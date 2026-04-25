import { createHash } from 'node:crypto'
import { toString as mdastToString } from 'mdast-util-to-string'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { Block, BlockType } from '../translation/types.js'
import { createSlugger } from './slugger.js'

const CUSTOM_ANCHOR_RE = /\s*\{#([a-zA-Z0-9_-]+)\}\s*$/

// Node types whose contents must NEVER be sent to the LLM — emitted verbatim.
const NON_TRANSLATABLE: ReadonlySet<string> = new Set(['code', 'thematicBreak', 'html', 'yaml'])

const processor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).use(remarkGfm)

interface PositionedNode {
  type: string
  depth?: number
  position?: {
    start: { offset?: number }
    end: { offset?: number }
  }
}

function nodeSlice(markdown: string, node: PositionedNode): string | undefined {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (typeof start !== 'number' || typeof end !== 'number') return undefined
  return markdown.slice(start, end)
}

function mapType(nodeType: string): BlockType {
  switch (nodeType) {
    case 'heading':
      return 'heading'
    case 'paragraph':
      return 'paragraph'
    case 'code':
      return 'code'
    case 'list':
      return 'list'
    case 'table':
      return 'table'
    case 'blockquote':
      return 'blockquote'
    case 'html':
      return 'html'
    case 'thematicBreak':
      return 'thematicBreak'
    case 'yaml':
      return 'frontmatter'
    default:
      return 'paragraph'
  }
}

/**
 * Parse one Markdown file into a flat sequence of Blocks. Each top-level mdast
 * node becomes one Block. Non-translatable blocks (code, yaml, html,
 * thematicBreak) are emitted with `translatable: false` and their `source`
 * must be written back byte-identical.
 */
export function splitFile(markdown: string, _filePath: string): Block[] {
  const tree = processor.parse(markdown) as unknown as {
    children: PositionedNode[]
  }
  const children = tree.children
  const slugger = createSlugger()

  // Document title = first H1.
  let documentTitle = ''
  for (const node of children) {
    if (node.type === 'heading' && node.depth === 1) {
      documentTitle = mdastToString(node as never)
      break
    }
  }

  const blocks: Block[] = []
  let currentSection = ''

  for (let i = 0; i < children.length; i++) {
    const node = children[i]!
    const source = nodeSlice(markdown, node)
    if (source === undefined) continue

    const type = mapType(node.type)
    const translatable = !NON_TRANSLATABLE.has(node.type)

    let anchorHint: string | undefined
    let customAnchor: string | undefined
    let headingLevel: number | undefined

    if (node.type === 'heading') {
      headingLevel = node.depth
      const raw = mdastToString(node as never)
      const m = raw.match(CUSTOM_ANCHOR_RE)
      if (m) {
        customAnchor = m[1]
        const cleaned = raw.replace(CUSTOM_ANCHOR_RE, '')
        anchorHint = slugger.slug(cleaned)
      } else {
        anchorHint = slugger.slug(raw)
      }

      // Update section tracking BEFORE we attach sectionTitle, so an H2
      // block's sectionTitle equals itself (it *is* the section).
      if (headingLevel === 2 || headingLevel === 3) {
        currentSection = raw.replace(CUSTOM_ANCHOR_RE, '')
      }
    }

    const sourceHash = createHash('sha256').update(source).digest('hex')
    const id = createHash('sha256').update(`${i}:${source}`).digest('hex').slice(0, 12)

    const prev = i > 0 ? nodeSlice(markdown, children[i - 1]!) : undefined
    const next = i < children.length - 1 ? nodeSlice(markdown, children[i + 1]!) : undefined

    blocks.push({
      id,
      type,
      source,
      sourceHash,
      translatable,
      anchorHint,
      customAnchor,
      headingLevel,
      documentTitle,
      sectionTitle: currentSection,
      prevBlockSource: prev,
      nextBlockSource: next,
    })
  }

  return blocks
}
