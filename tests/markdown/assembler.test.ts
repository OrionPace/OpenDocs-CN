import { describe, expect, it } from 'vitest'
import { assembleFile, type AssembledBlock } from '../../src/markdown/assembler.js'
import type { Block } from '../../src/translation/types.js'

function makeBlock(partial: Partial<Block> & Pick<Block, 'type' | 'source'>): Block {
  return {
    id: 'x',
    sourceHash: 'h'.repeat(64),
    translatable: true,
    documentTitle: 'Doc',
    sectionTitle: '',
    ...partial,
  } as Block
}

describe('assembleFile', () => {
  it('joins paragraph blocks with blank lines and ends with newline', () => {
    const parts: AssembledBlock[] = [
      { block: makeBlock({ type: 'paragraph', source: 'Hello.' }), translated: '你好。' },
      {
        block: makeBlock({ type: 'paragraph', source: 'World.' }),
        translated: '世界。',
      },
    ]
    expect(assembleFile(parts)).toBe('你好。\n\n世界。\n')
  })

  it('emits non-translatable code blocks byte-identical regardless of translated value', () => {
    const parts: AssembledBlock[] = [
      { block: makeBlock({ type: 'paragraph', source: 'Intro.' }), translated: '介绍。' },
      {
        block: makeBlock({
          type: 'code',
          source: '```bash\nnpm install\n```',
          translatable: false,
        }),
        translated: 'IGNORED',
      },
    ]
    const out = assembleFile(parts)
    expect(out).toContain('```bash\nnpm install\n```')
    expect(out).not.toContain('IGNORED')
  })

  it('appends {#anchor} to a translated heading when LLM dropped it', () => {
    const parts: AssembledBlock[] = [
      {
        block: makeBlock({
          type: 'heading',
          source: '## Installation',
          headingLevel: 2,
          anchorHint: 'installation',
        }),
        translated: '## 安装',
      },
    ]
    expect(assembleFile(parts)).toBe('## 安装 {#installation}\n')
  })

  it('preserves an existing {#anchor} when LLM kept it', () => {
    const parts: AssembledBlock[] = [
      {
        block: makeBlock({
          type: 'heading',
          source: '## Installation',
          headingLevel: 2,
          anchorHint: 'installation',
        }),
        translated: '## 安装 {#installation}',
      },
    ]
    expect(assembleFile(parts)).toBe('## 安装 {#installation}\n')
  })

  it('uses customAnchor when present (overrides anchorHint)', () => {
    const parts: AssembledBlock[] = [
      {
        block: makeBlock({
          type: 'heading',
          source: '## Setup {#custom-id}',
          headingLevel: 2,
          anchorHint: 'setup',
          customAnchor: 'custom-id',
        }),
        translated: '## 安装',
      },
    ]
    expect(assembleFile(parts)).toBe('## 安装 {#custom-id}\n')
  })

  it('skips anchor injection for headings without anchorHint or customAnchor', () => {
    const parts: AssembledBlock[] = [
      {
        block: makeBlock({
          type: 'heading',
          source: '## Setup',
          headingLevel: 2,
        }),
        translated: '## 安装',
      },
    ]
    expect(assembleFile(parts)).toBe('## 安装\n')
  })

  it('preserves frontmatter byte-identical', () => {
    const parts: AssembledBlock[] = [
      {
        block: makeBlock({
          type: 'frontmatter',
          source: '---\ntitle: Hello\n---',
          translatable: false,
        }),
        translated: '',
      },
      { block: makeBlock({ type: 'paragraph', source: 'Body.' }), translated: '正文。' },
    ]
    expect(assembleFile(parts)).toBe('---\ntitle: Hello\n---\n\n正文。\n')
  })
})
