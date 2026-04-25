import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { splitFile } from '../../src/markdown/splitter.js'

function fixture(): string {
  return readFileSync(resolve(__dirname, '../fixtures/sample.md'), 'utf8')
}

describe('splitFile', () => {
  it('produces one block per top-level mdast node', () => {
    const blocks = splitFile(fixture(), 'sample.md')
    const types = blocks.map((b) => b.type)
    // frontmatter + h1 + para + h2 + para + code + h2 + para + list + h3 + para + table + hr + blockquote + h2 + para
    expect(types[0]).toBe('frontmatter')
    expect(types).toContain('heading')
    expect(types).toContain('code')
    expect(types).toContain('list')
    expect(types).toContain('table')
    expect(types).toContain('blockquote')
    expect(types).toContain('thematicBreak')
  })

  it('marks code, frontmatter, html, thematicBreak as non-translatable', () => {
    const blocks = splitFile(fixture(), 'sample.md')
    for (const b of blocks) {
      if (b.type === 'code' || b.type === 'frontmatter' || b.type === 'thematicBreak') {
        expect(b.translatable).toBe(false)
      }
    }
  })

  it('paragraphs and headings are translatable', () => {
    const blocks = splitFile(fixture(), 'sample.md')
    for (const b of blocks) {
      if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'list') {
        expect(b.translatable).toBe(true)
      }
    }
  })

  it('generates anchorHint from heading text via github-slugger', () => {
    const blocks = splitFile(fixture(), 'sample.md')
    const gettingStarted = blocks.find((b) => b.type === 'heading' && b.headingLevel === 1)
    expect(gettingStarted?.anchorHint).toBe('getting-started')

    const installation = blocks.find(
      (b) => b.type === 'heading' && b.source.startsWith('## Installation'),
    )
    expect(installation?.anchorHint).toBe('installation')
  })

  it('preserves an existing {#custom-slug} as customAnchor', () => {
    const blocks = splitFile(fixture(), 'sample.md')
    const configured = blocks.find(
      (b) => b.type === 'heading' && b.source.includes('Configuration {#config}'),
    )
    expect(configured?.customAnchor).toBe('config')
    expect(configured?.anchorHint).toBe('configuration')
  })

  it('deduplicates repeated heading slugs (config → config → config-1)', () => {
    const blocks = splitFile(fixture(), 'sample.md')
    const configurationHeadings = blocks.filter(
      (b) => b.type === 'heading' && b.source.trim().startsWith('## Configuration'),
    )
    expect(configurationHeadings).toHaveLength(2)
    // first one has custom anchor; second is the collision
    const second = configurationHeadings[1]
    expect(second?.anchorHint).toBe('configuration-1')
  })

  it('sets documentTitle on every block to the first H1 text', () => {
    const blocks = splitFile(fixture(), 'sample.md')
    for (const b of blocks) {
      expect(b.documentTitle).toBe('Getting Started')
    }
  })

  it('sets prevBlockSource and nextBlockSource correctly', () => {
    const blocks = splitFile(fixture(), 'sample.md')
    expect(blocks[0]?.prevBlockSource).toBeUndefined()
    expect(blocks.at(-1)?.nextBlockSource).toBeUndefined()
    expect(blocks[1]?.prevBlockSource).toBe(blocks[0]?.source)
  })

  it('block source is byte-identical to the original slice', () => {
    const raw = fixture()
    const blocks = splitFile(raw, 'sample.md')
    for (const b of blocks) {
      expect(raw.includes(b.source)).toBe(true)
    }
  })

  it('computes stable sourceHash across runs', () => {
    const a = splitFile(fixture(), 'sample.md')
    const b = splitFile(fixture(), 'sample.md')
    expect(a.map((x) => x.sourceHash)).toEqual(b.map((x) => x.sourceHash))
  })
})
