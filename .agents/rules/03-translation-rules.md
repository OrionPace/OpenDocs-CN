# Translation Rules (binding for every LLM call)

These rules are mandatory. They go into every translation prompt AND are enforced by post-processing QA. A translation that violates any hard constraint is discarded and retried.

## 1. Hard constraints on LLM output

### 1.1 Never translate
- Content inside fenced code blocks ( ```...``` )
- Content inside inline code ( `...` )
- URLs, including the scheme and path
- URL fragment anchors (e.g. `#installation`) — **must stay in English** to match upstream heading anchors
- File paths with extensions (`config.toml`, `src/index.ts`, `docs/README.md`)
- Command-line invocations (flags, arguments, env var names)
- Environment variable names (`GEMINI_API_KEY`, `PATH`)
- Package, binary, and CLI names (`npm`, `pnpm`, `node`, `gemini`, `codex`, `docker`)
- HTML tags and their attribute names/values (except visible text content)

### 1.2 Preserve structure exactly
- Heading levels (`#`, `##`, `###`)
- List markers (`-`, `*`, `1.`)
- Table pipes `|` and alignment rows `|---|`
- Blockquote `>` markers
- Horizontal rules `---`
- Frontmatter delimiters `---` at top of file
- Link syntax: in `[text](url)`, translate `text`, never touch `url`
- Reference-style link labels: `[text][label]` — translate `text`, keep `label`

### 1.3 Output discipline
- Return **only** the translated Markdown.
- No preface ("Here is the translation: ..."), no explanation, no code-fence wrapping of the entire result.
- One input block → one output block. Do not split or merge blocks.

## 2. The anchor-preservation rule (critical — do not skip)

Upstream `## Installation` generates anchor `#installation`. If we translate to `## 安装`, VitePress generates `#安装`, and every internal link `[see](#installation)` from the original file **breaks silently**.

**Solution**: the AST splitter emits every translated heading with an explicit anchor referring to the original English slug:

```markdown
## 安装 {#installation}
```

Rules for the splitter:
- For every `heading` node in mdast, compute the slug from the original English text (use `github-slugger` with default settings, matching VitePress defaults).
- Attach the slug to the heading before sending to the LLM as `anchor_hint`; re-attach it to the translated heading on the way back as `{#slug}`.
- If the upstream heading already has a custom `{#custom-slug}` marker, preserve it verbatim and do not generate a new one.
- If VitePress config overrides the slugger, match that override here.

The QA layer verifies: every translated heading either has a `{#...}` or was marked as an intentional no-anchor case in the rules.

## 3. Glossary enforcement

Each translation request carries a list of **applicable glossary entries** — terms whose source form appears in the source block.

The matching function:
1. For each glossary entry, test whether `source` appears in the source block (word-boundary match, case-insensitive unless the entry says otherwise).
2. Inject matching entries into the prompt's `[GLOSSARY]` section.
3. After translation, verify that for each matched entry, the `target` term appears in the translated text.
4. If any matched term is missing, mark `glossary_violation`, retry once with the violated entries listed at the top of a stricter prompt.
5. If retry also fails, log and keep the best available translation (flagged for human review).

## 4. Context injection (required, not optional)

Block-level translation without context produces inconsistent voice and broken anaphora ("the above", "this section"). Every block-level call must include:

| Field | Purpose |
|---|---|
| `document_title` | H1 of the containing file |
| `section_title` | Nearest H2/H3 ancestor's text |
| `prev_block_source` | Source of the previous sibling block, verbatim English |
| `next_block_source` | Source of the next sibling block, verbatim English |
| `project_id` | For per-project prompt flavoring |

Context blocks are marked **READ-ONLY, DO NOT TRANSLATE** in the prompt. The prompt template (`04-translation-rules.md §7`) wraps them with explicit delimiters.

**Token budget**: context adds ~200-500 tokens. Acceptable. If the target block alone exceeds `MAX_BLOCK_TOKENS` (default 1500), the splitter should have split it smaller — that's a bug, not a reason to drop context.

## 5. Retry and fallback policy

### 5.1 Error classification

| Error | Action |
|---|---|
| HTTP 429 (rate limit) | Exponential backoff, base 2 s, max 5 attempts |
| HTTP 5xx | Exponential backoff, base 1 s, max 3 attempts, then fallback provider |
| Network/timeout | 3 attempts with 5s timeout each, then fallback provider |
| Output empty | Retry once with same prompt |
| Output fails Markdown parse | Retry once with stricter "output only Markdown" prompt |
| Output fails glossary check | Retry once with violated terms re-emphasized |
| Output heading anchor missing | Retry once with anchor re-emphasized |

### 5.2 Fallback chain
1. DeepSeek `deepseek-v4-flash`
2. DeepSeek `deepseek-v4-pro` (on structural-fail retry)
3. OpenRouter (configured model) — only if `OPENROUTER_API_KEY` is set
4. Give up: mark block as `status: failed` in translation memory; emit English source as placeholder; log with block ID for manual review

Every failed block is logged to `state/{project-id}.json#failed_blocks` with timestamp, reason, and block source hash so the next run can retry.

## 6. What NOT to do

- Do not ask the LLM to "improve", "polish", or "fix" the English source. Translate only.
- Do not request translations that change Markdown block structure. One block in, one block out.
- Do not send files over `MAX_BLOCK_TOKENS` in a single call — always split first.
- Do not concatenate multiple blocks to "save an API call". Each block is an independent cache unit with its own hash.
- Do not let the LLM generate new glossary entries. The glossary is human-authored.
- Do not re-translate blocks whose `(source_hash, glossary_hash, prompt_version)` triple is already in translation memory. Cache hits are free; LLM calls cost money and time.

## 7. Canonical translation prompt

Every block-level translation call uses this template, with variables filled at request time. Store it as a versioned constant; changing the prompt invalidates cache (because `prompt_version` is part of the cache key).

```
You are a technical documentation translator. Translate the specified Markdown block from English to Simplified Chinese.

[DOCUMENT TITLE]
{document_title}
[END DOCUMENT TITLE]

[SECTION]
{section_title}
[END SECTION]

[PREVIOUS BLOCK — CONTEXT ONLY, DO NOT TRANSLATE OR OUTPUT]
{prev_block_source}
[END PREVIOUS BLOCK]

[TRANSLATE THIS BLOCK]
{block_source}
[END BLOCK]

[NEXT BLOCK — CONTEXT ONLY, DO NOT TRANSLATE OR OUTPUT]
{next_block_source}
[END NEXT BLOCK]

[GLOSSARY — apply to this block]
{glossary_entries_yaml}
[END GLOSSARY]

[RULES]
1. Never translate content inside code fences or inline code.
2. Never translate URLs, URL anchors, file paths, CLI names, flags, or env var names.
3. Preserve Markdown structure: headings, lists, tables, quotes, frontmatter delimiters.
4. In links `[text](url)`: translate the visible text; the URL stays exact.
5. For every heading, keep the anchor-hint I gave you: output `## 译文 {#original-slug}`.
6. Keep English acronyms (CLI, API, MCP, LLM, JSON, YAML) untranslated.
7. Apply glossary terms exactly as given. If the source contains a glossary source term, the translation must contain its target term.
8. Output ONLY the translated Markdown block. No preface. No backticks around the whole output. No explanation.

Translate now.
```

`glossary_entries_yaml` is rendered like:
```yaml
- agent → 智能体 (note: fixed term in agent tooling; do not use 代理)
- sandbox → 沙箱
- MCP → MCP (keep as acronym; first occurrence may add "模型上下文协议")
```

## 8. Do-not-translate protection (regex guards, last line of defense)

After the LLM returns, run these regex checks. Any mismatch in count vs source = retry.

- Fenced code block count: `/```[\s\S]*?```/gm`
- Inline code count: `/`[^`\n]+`/g`
- URL count: `/https?:\/\/[^\s)]+/g`
- Heading count per level
- Link count: `/\[([^\]]+)\]\(([^)]+)\)/g`

If counts match but content of code blocks differs byte-for-byte from source, **restore from source** — this is not a retry, it's a deterministic repair.

## 9. Prompt versioning

- `PROMPT_VERSION = "v1.0.0"` lives in code.
- Every cache entry records the `prompt_version` that produced it.
- Bumping the version invalidates cache for all blocks — this is intentional and must be a conscious decision, not an accidental side-effect of editing the template.

## 10. What changes when we add a new project

Adding a new upstream project does **not** require changes to this file. It requires:
- New entry in `config/projects.yaml`
- Possibly a new `sidebar.override.yml` section
- Possibly new glossary terms in `glossary.yml`

All of the above are config, not code. Translation rules are project-agnostic.
