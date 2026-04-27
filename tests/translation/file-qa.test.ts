import { describe, it, expect } from 'vitest'
import { runFileQA, repairHtmlBalance } from '../../src/translation/file-qa.js'

const NO_GLOSSARY = [] as const

describe('runFileQA — htmlTagBalance', () => {
  it('passes when source and translation are both balanced', () => {
    const src = '<details><summary>x</summary>y</details>'
    const tr = '<details><summary>甲</summary>乙</details>'
    const result = runFileQA(src, tr, NO_GLOSSARY)
    expect(result.failures.filter((f) => f.name === 'htmlTagBalance')).toHaveLength(0)
    expect(result.passed).toBe(true)
  })

  it('fails when source is balanced but translation is missing closing tag', () => {
    const src = '<details><summary>x</summary>y</details>'
    const tr = '<details><summary>甲</summary>乙'
    const result = runFileQA(src, tr, NO_GLOSSARY)
    const htmlFails = result.failures.filter((f) => f.name === 'htmlTagBalance')
    expect(htmlFails.length).toBeGreaterThan(0)
    expect(result.passed).toBe(false)
    // details tag should be flagged
    expect(htmlFails.some((f) => f.details?.includes('tag=details'))).toBe(true)
  })

  it('does not flag void elements like <br> and <img>', () => {
    const src = 'line1<br>line2<img src="a.png">end'
    const tr = '行1<br>行2<img src="a.png">结束'
    const result = runFileQA(src, tr, NO_GLOSSARY)
    expect(result.failures.filter((f) => f.name === 'htmlTagBalance')).toHaveLength(0)
    expect(result.passed).toBe(true)
  })

  it('ignores HTML inside fenced code blocks', () => {
    const src = '```\n<div>unclosed\n```\nplain text'
    const tr = '```\n<div>unclosed\n```\n普通文字'
    const result = runFileQA(src, tr, NO_GLOSSARY)
    expect(result.failures.filter((f) => f.name === 'htmlTagBalance')).toHaveLength(0)
    expect(result.passed).toBe(true)
  })

  it('does not fail when source itself is unbalanced (upstream problem)', () => {
    // Both source and translation share the same imbalance → not a translation error
    const src = '<details>unclosed'
    const tr = '<details>未闭合'
    const result = runFileQA(src, tr, NO_GLOSSARY)
    expect(result.failures.filter((f) => f.name === 'htmlTagBalance')).toHaveLength(0)
  })
})

describe('repairHtmlBalance', () => {
  it('appends missing closing tags', () => {
    const repaired = repairHtmlBalance('<details><summary>x</summary>content')
    expect(repaired).toContain('</details>')
    expect((repaired.match(/<details/g) ?? []).length).toBe(
      (repaired.match(/<\/details>/g) ?? []).length,
    )
  })

  it('leaves balanced content unchanged', () => {
    const balanced = '<details><summary>x</summary>y</details>'
    expect(repairHtmlBalance(balanced)).toBe(balanced)
  })

  it('appends correct count of missing closes', () => {
    // Two opens, zero closes
    const repaired = repairHtmlBalance('<div><div>content')
    expect((repaired.match(/<\/div>/g) ?? []).length).toBe(2)
  })

  it('ignores HTML in fenced code blocks', () => {
    const text = '```\n<div>unclosed\n```\nplain'
    expect(repairHtmlBalance(text)).toBe(text)
  })

  it('ignores HTML-like tokens inside inline code spans', () => {
    // `<crate>` is CLI placeholder syntax, not a real HTML tag
    const text = 'run `just fix -p <crate>` to build'
    expect(repairHtmlBalance(text)).toBe(text)
  })
})
