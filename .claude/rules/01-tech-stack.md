# 技术栈（已锁定）

未经询问，不要替换以下选择。如果下面某项选择不适合某个具体任务，请先询问再偏离。

## 语言与运行时

- **TypeScript 5.6+**，`strict: true`，`noUncheckedIndexedAccess: true`
- **Node.js 22 LTS**。CI 使用 `actions/setup-node@v4`，并通过 `node-version-file: .nvmrc` 固定版本。
- **pnpm 9.x**。提交 lockfile。不要使用 `npm` 或 `yarn`。

## 静态站点

- **VitePress 1.5+**
- 默认主题，覆盖浅色模式颜色（不 fork 主题）
- 启用内置本地搜索，不配置 Algolia
- 多侧边栏：每个项目路由对应一个侧边栏

## Markdown 处理

- **unified** 生态：
  - `unified`
  - `remark-parse` — 英文 Markdown → mdast
  - `remark-stringify` — mdast → Markdown
  - `remark-gfm` — 表格、删除线、任务列表、自动链接
  - `remark-frontmatter` — 保留 YAML frontmatter
- **不要使用** `marked`、`markdown-it`，也不要用基于正则的 Markdown 解析做任何转换。只使用 AST。（预览/渲染使用 VitePress 自己的流水线；我们只在同步/翻译阶段处理 Markdown。）

## 存储

- **better-sqlite3 11.x** 用于 translation memory（同步 API，每个项目在 `translation-memory/{project-id}.sqlite` 下一个文件）
- 普通 JSON 用于每个项目的同步状态（`state/{project-id}.json`）
- YAML 用于用户编写的配置（`config/*.yml` 或 `*.yaml`）

## LLM 提供商（按优先级排序）

### 1. DeepSeek（主用，必需）

- **base_url**：`https://api.deepseek.com`（OpenAI 兼容）
- **默认模型**：`deepseek-v4-flash`
- **升级模型**（用于超过 1200 tokens 的块，或一次重试失败后）：`deepseek-v4-pro`
- **API 兼容性**：OpenAI SDK 格式（`POST /chat/completions`）
- **环境变量**：`DEEPSEEK_API_KEY`
- **已废弃**（不要使用，EOL 2026-07-24）：`deepseek-chat`、`deepseek-reasoner`

### 2. OpenRouter（兜底，可选）

- **base_url**：`https://openrouter.ai/api/v1`
- **默认模型**：通过环境变量 `OPENROUTER_MODEL` 配置，建议 `deepseek/deepseek-chat` 或 `google/gemini-2.5-flash`
- **环境变量**：`OPENROUTER_API_KEY`
- **触发条件**：DeepSeek 连续两次返回 5xx，或严重限流（429 × 3 且退避耗尽）
- 注意：OpenRouter 免费层在未充值时为 50 req/day；不要依赖它完成 full-sync。假设使用付费额度；如果没有 key，则完全跳过。

### 3. Provider 接口

```ts
interface TranslationProvider {
  readonly name: string;
  translate(req: TranslationRequest): Promise<TranslationResponse>;
  healthCheck(): Promise<boolean>;
}
```

实现：`DeepSeekProvider`、`OpenRouterProvider`。通过 `config/providers.yml` 的有序列表进行选择。新增提供商（Anthropic、Gemini direct、本地 Ollama）只需实现该接口，无需改动其他位置。

## 关键库

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
  "openai": "^4.70.0",           // 用于 DeepSeek 和 OpenRouter（二者都兼容 OpenAI）
  "p-retry": "^6.2.0",            // 退避
  "p-limit": "^6.1.0",            // 并发上限
  "picocolors": "^1.1.0",         // CLI 输出
  "commander": "^12.1.0",         // CLI 参数解析
  "dotenv": "^16.4.0"
}
```

Dev：

```jsonc
{
  "vitest": "^2.1.0",
  "eslint": "^9.15.0",
  "@typescript-eslint/parser": "^8.15.0",
  "@typescript-eslint/eslint-plugin": "^8.15.0",
  "prettier": "^3.3.0",
  "tsx": "^4.19.0",               // 直接运行 TS
  "@types/node": "^22.9.0",
  "@types/better-sqlite3": "^7.6.0"
}
```

## CLI 入口

单一二进制入口：`pnpm run <script>`。所有主要操作都是 npm scripts：

- `pnpm sync` — 同步所有项目，首次运行全量同步，后续增量同步
- `pnpm sync --project gemini-cli` — 同步单个项目
- `pnpm sync --full` — 强制全量重新翻译（忽略缓存）
- `pnpm qa` — 对当前状态运行 QA（不调用 LLM）
- `pnpm build` — 运行 `vitepress build`
- `pnpm dev` — 运行 `vitepress dev`
- `pnpm test` — vitest
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — eslint + prettier check
- `pnpm fix` — eslint + prettier write

## 部署

- **主站**：GitHub Pages。Workflow 将构建后站点推送到 `gh-pages` 分支。
- **镜像**：Cloudflare Pages。连接到仓库，推送到 `main` 后自动构建。
- **以后可选**：Gitee Pages 镜像，用于中国大陆访问（初期手动触发）。

## 为什么选择这些（避免你忍不住重构时参考）

- **TS 而不是 Python**：VitePress 和整个构建链都是 JS。一个运行时比两个运行时更容易交付和调试。
- **pnpm 而不是 npm**：更快、更小的 node_modules，并且在需要时已准备好 workspaces。
- **better-sqlite3 而不是 JSON**：translation memory 会增长到 10k+ 行；JSON 查找会变成 O(n) 文件读取。带索引查找的 SQLite 是块哈希键的合适工具。
- **unified 而不是 regex**：Markdown 不是正则语言。任何基于正则的方法都会在表格、嵌套代码或 HTML-in-md 上出问题。
- **VitePress 而不是 Docusaurus/Rspress**：VitePress 体积最小，默认主题对中文文本渲染最干净，而且用户明确要求使用它。Rspress 更新、训练数据中资料更少；Docusaurus 对两个项目来说过重。
- **DeepSeek 而不是 Gemini/OpenAI**：用户有付费 DeepSeek 账号，并且在 2026 年 4 月，`deepseek-v4-flash` 对此任务有最佳成本/质量比。
