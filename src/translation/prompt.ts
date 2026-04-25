import { renderGlossaryYaml } from './glossary.js'
import type { GlossaryEntry, TranslationRequest } from './types.js'

/**
 * Bumping this string invalidates all cached translations in
 * `translation-memory/*.sqlite`. Any change to the template below is a
 * conscious, reviewed decision that costs real money to re-translate.
 */
export const PROMPT_VERSION = 'v1.0.0'

/**
 * Canonical block-level translation prompt. See
 * .claude/rules/03-translation-rules.md §7 — this file is the code-side
 * authority and must stay in sync with that spec (changes to either require
 * bumping PROMPT_VERSION).
 */
export function buildPrompt(
  req: TranslationRequest,
  glossaryEntries: readonly GlossaryEntry[],
): string {
  const { block } = req
  const anchorHint = block.anchorHint
    ? block.customAnchor
      ? `{#${block.customAnchor}}  // upstream already provided this; keep verbatim`
      : `{#${block.anchorHint}}`
    : '(not a heading)'

  return [
    'You are a technical documentation translator. Translate the specified Markdown block from English to Simplified Chinese.',
    '',
    '[DOCUMENT TITLE]',
    block.documentTitle || '(untitled)',
    '[END DOCUMENT TITLE]',
    '',
    '[SECTION]',
    block.sectionTitle || '(top-level)',
    '[END SECTION]',
    '',
    '[PREVIOUS BLOCK — CONTEXT ONLY, DO NOT TRANSLATE OR OUTPUT]',
    block.prevBlockSource ?? '(none)',
    '[END PREVIOUS BLOCK]',
    '',
    '[TRANSLATE THIS BLOCK]',
    block.source,
    '[END BLOCK]',
    '',
    '[NEXT BLOCK — CONTEXT ONLY, DO NOT TRANSLATE OR OUTPUT]',
    block.nextBlockSource ?? '(none)',
    '[END NEXT BLOCK]',
    '',
    '[GLOSSARY — apply to this block]',
    renderGlossaryYaml(glossaryEntries),
    '[END GLOSSARY]',
    '',
    '[ANCHOR HINT — for headings only]',
    anchorHint,
    '[END ANCHOR HINT]',
    '',
    '[RULES]',
    '1. Never translate content inside code fences or inline code.',
    '2. Never translate URLs, URL anchors, file paths, CLI names, flags, or env var names.',
    '3. Preserve Markdown structure: headings, lists, tables, quotes, frontmatter delimiters.',
    '4. In links `[text](url)`: translate the visible text; the URL stays exact.',
    '5. For every heading, keep the anchor-hint I gave you: output `## 译文 {#original-slug}`.',
    '6. Keep English acronyms (CLI, API, MCP, LLM, JSON, YAML) untranslated.',
    '7. Apply glossary terms exactly as given. If the source contains a glossary source term, the translation must contain its target term.',
    '8. Output ONLY the translated Markdown block. No preface. No backticks around the whole output. No explanation.',
    '',
    'Translate now.',
  ].join('\n')
}
