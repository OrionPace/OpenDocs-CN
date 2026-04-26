import { renderGlossaryYaml } from './glossary.js'
import type { GlossaryEntry, TranslationRequest } from './types.js'

/**
 * Bumping this string invalidates ALL cached translations. Architectural
 * change in v2.0.0: paragraph-level blocks → file-level (or H2-section-level
 * for very large files) translation. Single LLM call per chunk; the model
 * sees full context within a chunk and is instructed to preserve every
 * code fence, URL, and `{#anchor}` verbatim.
 */
export const PROMPT_VERSION = 'v2.0.0'

/**
 * Build the file-/section-level translation prompt. Receives the entire chunk
 * source and returns a prompt asking for the translated chunk back, with
 * structure preserved exactly.
 */
export function buildPrompt(
  req: TranslationRequest,
  glossaryEntries: readonly GlossaryEntry[],
): string {
  const { chunk, upstreamPath } = req
  const positionHint =
    chunk.isFirst && chunk.isLast
      ? 'a complete Markdown file'
      : chunk.isFirst
        ? `the FIRST section of ${upstreamPath} (frontmatter and intro included)`
        : chunk.isLast
          ? `the LAST section of ${upstreamPath}`
          : `a middle section of ${upstreamPath}`

  return [
    'You are a professional technical documentation translator. Translate the following Markdown from English to Simplified Chinese.',
    '',
    `[CONTEXT] You are translating ${positionHint}.`,
    '',
    '[GLOSSARY — apply these terms consistently]',
    renderGlossaryYaml(glossaryEntries),
    '[END GLOSSARY]',
    '',
    '[RULES — non-negotiable]',
    '1. Preserve EVERY fenced code block (```...```) and inline code (`...`) byte-for-byte. Never translate code or comments inside code.',
    '2. Preserve EVERY URL and URL fragment exactly. In links `[text](url)`: translate `text`, keep `url` verbatim.',
    '3. Preserve heading levels (`#`, `##`, `###`) and any `{#anchor}` markers attached to them — copy them through verbatim. Do NOT generate new anchors.',
    '4. Preserve list markers (`-`, `*`, `1.`), table pipes (`|`), table alignment rows (`|---|`), blockquote `>`, horizontal rules `---`, and frontmatter `---` delimiters.',
    '5. Never translate: file paths with extensions (`config.toml`, `src/index.ts`), CLI names (`npm`, `pnpm`, `node`, `gemini`, `codex`), command flags (`--help`), env var names (`GEMINI_API_KEY`), HTML tag/attribute names.',
    '6. Keep English acronyms untranslated: CLI, API, MCP, LLM, JSON, YAML, TOML, URL, HTTP, SDK.',
    '7. Apply the glossary EXACTLY: if a source term appears, the translation MUST contain its target term.',
    '8. Output ONLY the translated Markdown. No preface, no commentary, no surrounding code fence. Same structure, same number of headings, same number of code blocks, same number of links.',
    '',
    '[SOURCE]',
    chunk.source,
    '[END SOURCE]',
    '',
    'Translate the [SOURCE] section now. Output the translated Markdown only.',
  ].join('\n')
}
