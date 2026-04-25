# Tech Stack (locked)

Do not swap these without asking. If a choice below doesn't fit a specific task, ask before deviating.

## Language & runtime

- **TypeScript 5.6+**, `strict: true`, `noUncheckedIndexedAccess: true`
- **Node.js 22 LTS**. CI pins to `actions/setup-node@v4` with `node-version-file: .nvmrc`.
- **pnpm 9.x**. Lockfile committed. Do not use `npm` or `yarn`.

## Static site

- **VitePress 1.5+**
- Default theme with light color overrides (no theme fork)
- Built-in local search enabled, Algolia is not configured
- Multi-sidebar: one sidebar per project route

## Markdown processing

- **unified** ecosystem:
  - `unified`
  - `remark-parse` — English Markdown → mdast
  - `remark-stringify` — mdast → Markdown
  - `remark-gfm` — tables, strikethrough, task lists, autolinks
  - `remark-frontmatter` — preserve YAML frontmatter
- **Do not use** `marked`, `markdown-it`, or regex-based Markdown parsing for any transformation. AST only. (Preview/render uses VitePress's own pipeline; we touch Markdown only at sync/translate time.)

## Storage

- **better-sqlite3 11.x** for translation memory (synchronous API, one file per project under `translation-memory/{project-id}.sqlite`)
- Plain JSON for per-project sync state (`state/{project-id}.json`)
- YAML for user-authored config (`config/*.yml` or `*.yaml`)

## LLM providers (in priority order)

### 1. DeepSeek (primary, required)

- **base_url**: `https://api.deepseek.com` (OpenAI-compatible)
- **default model**: `deepseek-v4-flash`
- **upgrade model** (used for blocks > 1200 tokens or after one retry failure): `deepseek-v4-pro`
- **API compatibility**: OpenAI SDK format (`POST /chat/completions`)
- **env var**: `DEEPSEEK_API_KEY`
- **Deprecated** (do not use, EOL 2026-07-24): `deepseek-chat`, `deepseek-reasoner`

### 2. OpenRouter (fallback, optional)

- **base_url**: `https://openrouter.ai/api/v1`
- **default model**: configured via env `OPENROUTER_MODEL`, suggest `deepseek/deepseek-chat` or `google/gemini-2.5-flash`
- **env var**: `OPENROUTER_API_KEY`
- **Triggered when**: DeepSeek returns 5xx twice or rate-limits hard (429 × 3 with backoff exhausted)
- Note: OpenRouter free-tier is 50 req/day without credits; do not rely on it for full-sync. Assume paid or skip entirely if no key present.

### 3. Provider interface

```ts
interface TranslationProvider {
  readonly name: string;
  translate(req: TranslationRequest): Promise<TranslationResponse>;
  healthCheck(): Promise<boolean>;
}
```

Implementations: `DeepSeekProvider`, `OpenRouterProvider`. Selection via `config/providers.yml` ordered list. New providers (Anthropic, Gemini direct, local Ollama) plug in by implementing the interface — no changes elsewhere.

## Key libraries

```jsonc
{
  "typescript": "^5.6.0",
  "vitepress": "^1.5.0",
  "unified": "^11.0.0",
  "remark-parse": "^11.0.0",
  "remark-stringify": "^11.0.0",
  "remark-gfm": "^4.0.0",
  "remark-frontmatter": "^5.0.0",
  "mdast-util-to-string": "^4.0.0",
  "@octokit/rest": "^21.0.0",
  "better-sqlite3": "^11.0.0",
  "zod": "^3.23.0",
  "yaml": "^2.6.0",
  "openai": "^4.70.0",           // used for DeepSeek and OpenRouter (both OpenAI-compatible)
  "p-retry": "^6.2.0",            // backoff
  "p-limit": "^6.1.0",            // concurrency cap
  "picocolors": "^1.1.0",         // CLI output
  "commander": "^12.1.0",         // CLI arg parsing
  "dotenv": "^16.4.0"
}
```

Dev:

```jsonc
{
  "vitest": "^2.1.0",
  "eslint": "^9.15.0",
  "@typescript-eslint/parser": "^8.15.0",
  "@typescript-eslint/eslint-plugin": "^8.15.0",
  "prettier": "^3.3.0",
  "tsx": "^4.19.0",               // run TS directly
  "@types/node": "^22.9.0",
  "@types/better-sqlite3": "^7.6.0"
}
```

## CLI entrypoint

Single binary: `pnpm run <script>`. All major ops are npm scripts:

- `pnpm sync` — full sync of all projects (first run) or incremental (subsequent)
- `pnpm sync --project gemini-cli` — sync one project
- `pnpm sync --full` — force full re-translation (ignore cache)
- `pnpm qa` — run QA on current state (no LLM calls)
- `pnpm build` — run `vitepress build`
- `pnpm dev` — run `vitepress dev`
- `pnpm test` — vitest
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — eslint + prettier check
- `pnpm fix` — eslint + prettier write

## Deployment

- **Primary**: GitHub Pages. Workflow pushes built site to `gh-pages` branch.
- **Mirror**: Cloudflare Pages. Connected to the repo, auto-builds on push to `main`.
- **Optional later**: Gitee Pages mirror for mainland China access (triggered manually at first).

## Why these choices (in case you're tempted to refactor)

- **TS over Python**: VitePress and the entire build chain is JS. One runtime is simpler to ship and debug than two.
- **pnpm over npm**: faster, smaller node_modules, workspaces ready when we need them.
- **better-sqlite3 over JSON**: translation memory grows to 10k+ rows; JSON lookups become O(n) file reads. SQLite with indexed lookups is the right tool for block-hash keys.
- **unified over regex**: Markdown is not a regular language. Any regex-based approach will break on tables, nested code, or HTML-in-md.
- **VitePress over Docusaurus/Rspress**: VitePress has the smallest footprint, cleanest default theme for Chinese text rendering, and the user explicitly asked for it. Rspress is newer and less well-documented in training data; Docusaurus is heavier than we need for two projects.
- **DeepSeek over Gemini/OpenAI**: the user has a paid DeepSeek account and `deepseek-v4-flash` has the best cost/quality for this task in April 2026.
