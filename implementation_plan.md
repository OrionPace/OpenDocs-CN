# OpenDocs-CN 实现计划

> 本文档驱动所有代码实现。工作流为：
> `implementation_plan.md` → 提取当前任务到 `task.md` → 实现 → 人工审查 → 下一个任务。
>
> 不可跳过任务或调整顺序。每个任务的产出是下一个任务的输入。

---

## 概述

一条自动化管道：从 GitHub 开源项目同步英文文档，通过 LLM API 以块级增量缓存的方式翻译为简体中文，并发布为多项目 VitePress 静态站点。

**第一阶段 MVP**：仅两个项目 —— Gemini CLI（路由 `/gemini-cli/`）和 Codex CLI（路由 `/codex/`）。

---

## 目录结构

```
opendocs-cn/
├── .github/
│   └── workflows/
│       ├── sync.yml          # 定时同步 + 翻译 + 部署
│       └── ci.yml            # PR/push 时的类型检查 + 格式检查 + 测试
│
├── config/
│   ├── projects.yaml         # 上游项目定义
│   ├── providers.yml         # LLM 提供商有序列表
│   └── glossary.yml          # 人工维护的术语表
│
├── docs/
│   ├── .vitepress/
│   │   └── config.ts         # VitePress 配置（多侧边栏）
│   ├── index.md              # 主页：两个项目卡片 + 免责声明
│   ├── public/
│   │   └── licenses/
│   │       ├── gemini-cli/
│   │       │   ├── LICENSE.txt
│   │       │   └── NOTICE.txt
│   │       └── codex/
│   │           ├── LICENSE.txt
│   │           └── NOTICE.txt
│   ├── gemini-cli/           # 翻译后的文档（自动生成，勿手动编辑）
│   └── codex/                # 翻译后的文档（自动生成，勿手动编辑）
│
├── src/
│   ├── config/
│   │   ├── schema.ts         # 所有配置文件的 Zod Schema
│   │   └── loader.ts         # 启动时加载并验证所有配置
│   │
│   ├── sync/
│   │   ├── github.ts         # Octokit：获取文件树 + 内容 + 许可证文件
│   │   └── state.ts          # 读写 state/{project-id}.json
│   │
│   ├── markdown/
│   │   ├── splitter.ts       # unified 管道：文件字符串 → Block[]
│   │   ├── assembler.ts      # Block[] + 翻译映射 → 文件字符串
│   │   └── slugger.ts        # github-slugger 封装（与 VitePress 默认行为一致）
│   │
│   ├── translation/
│   │   ├── types.ts          # Block、TranslationRequest、TranslationResponse、CacheKey
│   │   ├── memory.ts         # better-sqlite3：get / set / markFailed
│   │   ├── prompt.ts         # 标准提示词模板 + PROMPT_VERSION 常量
│   │   ├── glossary.ts       # 词界匹配 + YAML 渲染器
│   │   ├── providers/
│   │   │   ├── interface.ts  # TranslationProvider 接口
│   │   │   ├── deepseek.ts   # DeepSeekProvider（flash + pro 升级）
│   │   │   └── openrouter.ts # OpenRouterProvider（备用）
│   │   ├── engine.ts         # 编排：缓存 → 提供商 → 重试 → QA → 写入
│   │   └── qa.ts             # 翻译后结构校验
│   │
│   ├── pipeline/
│   │   ├── runner.ts         # 单项目同步循环（p-limit 并发控制）
│   │   └── writer.ts         # 写入翻译文件 + 归属 footer
│   │
│   └── vitepress/
│       └── sidebar.ts        # 从 docs/ 目录树生成 VitePress 侧边栏配置
│
├── scripts/
│   ├── sync.ts               # CLI 入口（commander）：pnpm sync
│   └── qa.ts                 # 独立 QA 运行器：pnpm qa
│
├── state/                    # 已加入 .gitignore；每项目 JSON 同步状态
├── translation-memory/       # 已加入 .gitignore；每项目 SQLite 文件
│
├── tests/
│   ├── markdown/
│   │   ├── splitter.test.ts
│   │   └── assembler.test.ts
│   ├── translation/
│   │   ├── memory.test.ts
│   │   ├── glossary.test.ts
│   │   └── qa.test.ts
│   └── fixtures/             # 单元测试用的示例 .md 文件
│
├── .env.example
├── .gitattributes            # * text=auto eol=lf
├── .gitignore
├── .nvmrc                    # 22
├── LICENSE                   # MIT（仅适用于基础设施代码）
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 模块规格

### src/translation/types.ts

```ts
export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'code'
  | 'list'
  | 'table'
  | 'blockquote'
  | 'html'
  | 'thematicBreak'
  | 'frontmatter'

export interface Block {
  id: string              // SHA256(文件内位置 + source) 前12位
  type: BlockType
  source: string          // 该块的原始英文 Markdown 文本
  sourceHash: string      // SHA256(source)，十六进制
  translatable: boolean   // false：code、thematicBreak、html、frontmatter
  anchorHint?: string     // 仅 heading：原始英文的 github-slugger slug
  headingLevel?: number   // 仅 heading：1-6
  documentTitle: string   // 所在文件的 H1 标题
  sectionTitle: string    // 最近的 H2/H3 祖先标题（无则为空字符串）
  prevBlockSource?: string
  nextBlockSource?: string
}

export interface GlossaryEntry {
  source: string          // 英文术语，如 "agent"
  target: string          // 中文术语，如 "智能体"
  caseSensitive?: boolean
  note?: string
}

export interface CacheKey {
  sourceHash: string
  glossaryHash: string    // SHA256(JSON.stringify(已排序的 target 字符串数组))
  promptVersion: string   // 如 "v1.0.0"
}

export interface TranslationRequest {
  block: Block
  glossaryEntries: GlossaryEntry[]
  projectId: string
  upstreamCommitSha: string
}

export interface TranslationResponse {
  translated: string
  cacheHit: boolean
  providerUsed?: string
  modelUsed?: string
  tokensUsed?: number
  retryCount?: number
  glossaryViolations?: string[]
  anchorRestored?: boolean
  status: 'ok' | 'failed'
  failReason?: string
}

export interface ProjectState {
  projectId: string
  lastSyncTime: string       // ISO 8601 UTC
  lastSyncSha: string        // 上游 commit SHA
  fileCount: number
  translatedCount: number
  cacheHitCount: number
  failedBlocks: FailedBlock[]
  qaReport?: QAReport
}

export interface FailedBlock {
  blockId: string
  reason: string
  sourceHash: string
  timestamp: string
}

export interface QAReport {
  generatedAt: string
  overallPass: boolean
  fileResults: FileQAResult[]
}

export interface FileQAResult {
  filePath: string
  passed: boolean
  checks: QACheck[]
}

export interface QACheck {
  name: string
  passed: boolean
  details?: string
}
```

### src/sync/github.ts

```ts
export interface FileEntry {
  path: string        // docs/ 下的相对路径，如 "index.md"
  sha: string         // git blob SHA（用于检测变更）
  downloadUrl: string
}

export async function fetchFileTree(project: ProjectConfig): Promise<FileEntry[]>
export async function fetchFileContent(project: ProjectConfig, path: string): Promise<string>
export async function fetchLicenseFiles(project: ProjectConfig): Promise<{
  license: string
  notice?: string
}>
```

### src/markdown/splitter.ts

```ts
// 入口：将完整 .md 文件解析为扁平的 Block 数组
export function splitFile(markdown: string, filePath: string): Block[]
```

分块规则：
- mdast 中每个顶层节点对应一个 Block（heading、paragraph、list、table、code、blockquote、thematicBreak、html、yaml/frontmatter）
- 若块的纯文本长度超过 `MAX_BLOCK_CHARS = 4000`，沿内部节点边界递归拆分
- `translatable: false` 适用于：`code`、`thematicBreak`、`html`、`yaml`（frontmatter）
- `heading` 节点：用 `slugger.ts` 计算 `anchorHint`；若已有 `{#custom-slug}` 标记则原样保留，不重新生成
- 附加上下文：`documentTitle`（文件首个 H1）、`sectionTitle`（最近的 H2/H3 祖先）、`prevBlockSource`、`nextBlockSource`

### src/markdown/assembler.ts

```ts
// 将 blocks + 翻译映射重新组合为翻译后的 .md 文件
export function assembleFile(
  blocks: Block[],
  translations: Map<string, string>,  // blockId → 翻译后的字符串
  meta: { upstreamPath: string; commitSha: string; repoOwner: string; repoName: string }
): string
```

规则：
- `translatable: false` 的块：原样使用 `block.source`（字节一致）
- heading 块：若设置了 `anchorHint` 且原始无自定义锚点，则在翻译标题行末尾追加 `{#anchorHint}`
- 由 `writer.ts` 负责追加归属 footer（不在此处处理）
- 使用 `remark-stringify` 序列化 mdast；禁止用字符串拼接生成 Markdown

### src/translation/memory.ts

SQLite Schema（文件：`translation-memory/{projectId}.sqlite`）：

```sql
CREATE TABLE IF NOT EXISTS translations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source_hash      TEXT    NOT NULL,
  glossary_hash    TEXT    NOT NULL,
  prompt_version   TEXT    NOT NULL,
  source_text      TEXT    NOT NULL,
  translated_text  TEXT    NOT NULL,
  block_type       TEXT    NOT NULL,
  project_id       TEXT    NOT NULL,
  file_path        TEXT,
  provider         TEXT,
  model            TEXT,
  tokens_input     INTEGER,
  tokens_output    INTEGER,
  retry_count      INTEGER DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'ok',
  glossary_violations TEXT,
  reviewed         INTEGER DEFAULT 0,
  reviewer         TEXT,
  upstream_sha     TEXT,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now')),
  UNIQUE(source_hash, glossary_hash, prompt_version)
);

CREATE INDEX IF NOT EXISTS idx_cache_key
  ON translations(source_hash, glossary_hash, prompt_version);
CREATE INDEX IF NOT EXISTS idx_project
  ON translations(project_id);
CREATE INDEX IF NOT EXISTS idx_status
  ON translations(status);
```

```ts
export interface MemoryRecord {
  translatedText: string
  status: 'ok' | 'failed' | 'pending_review'
  reviewed: boolean
}

export class TranslationMemory {
  constructor(projectId: string)
  get(key: CacheKey): MemoryRecord | null
  set(key: CacheKey, record: ...): void
  markFailed(key: CacheKey, reason: string): void
  close(): void
}
```

### src/translation/prompt.ts

```ts
export const PROMPT_VERSION = 'v1.0.0'

// 标准提示词模板 —— 不得修改，除非同步 bump PROMPT_VERSION
export function buildPrompt(req: TranslationRequest, glossaryEntries: GlossaryEntry[]): string
```

模板内容为 `.claude/rules/03-translation-rules.md §7` 的原文。任何对模板的修改都必须 bump `PROMPT_VERSION`（这会使所有缓存失效，此为预期行为）。

### src/translation/providers/interface.ts

```ts
export interface TranslationProvider {
  readonly name: string
  translate(prompt: string, maxTokens: number): Promise<string>
  healthCheck(): Promise<boolean>
}
```

### src/translation/engine.ts

```ts
export async function translateBlock(
  req: TranslationRequest,
  providers: TranslationProvider[],
  memory: TranslationMemory
): Promise<TranslationResponse>
```

执行流程（严格按序）：
1. 计算 `CacheKey`；调用 `memory.get(key)` —— 命中则立即返回
2. 筛选适用于 `req.block.source` 的术语表条目
3. 通过 `prompt.ts` 构建提示词
4. 选择模型：默认 `deepseek-v4-flash`；块超过 1200 token 时升级为 `deepseek-v4-pro`
5. 调用提供商，附带重试逻辑（见下表）
6. 对响应执行 `qa.ts` 检查
7. QA 失败：以更严格的提示词重试一次；仍失败则尝试下一个提供商
8. 所有提供商耗尽：`memory.markFailed(key, reason)`，以英文原文作为占位符返回
9. 成功：`memory.set(key, ...)` → 返回响应

并发控制：文件内用 `p-limit(3)` 包装 `translateBlock` 调用，文件间用 `p-limit(1)`。

### src/translation/qa.ts

翻译后的结构校验（全部通过才算成功；任一失败触发一次重试）：

| 检查项 | 方法 |
|---|---|
| `codeFenceCount` | 统计 `/```[\s\S]*?```/gm` 在原文与译文中的数量 |
| `inlineCodeCount` | 统计 `` /`[^`\n]+`/g `` 在原文与译文中的数量 |
| `urlCount` | 统计 `/https?:\/\/[^\s)]+/g` 在原文与译文中的数量 |
| `headingCount` | 按级别统计 `#` 前缀行数量 |
| `linkCount` | 统计 `/\[([^\]]+)\]\(([^)]+)\)/g` 在原文与译文中的数量 |
| `codeFenceContent` | 每个代码围栏的内容必须与原文字节一致；不一致则从原文恢复（确定性修复，不重试） |
| `headingAnchor` | 每个翻译标题均含 `{#...}`（除非 `translatable: false`） |
| `glossaryTerms` | 每个匹配的术语表条目的目标词必须出现在译文中 |

### src/pipeline/writer.ts

```ts
export async function writeTranslatedFile(params: {
  projectId: string
  filePath: string            // docs/{projectId}/ 下的相对路径
  content: string             // 组装好的 Markdown（不含 footer）
  upstreamPath: string
  commitSha: string
  repoOwner: string
  repoName: string
  ourRepo: string
}): Promise<void>
```

由本函数追加的归属 footer（不存入翻译记忆库）：

```markdown

---
> 本页译自 [`{repoOwner}/{repoName}` @ `{sha7}`](https://github.com/{repoOwner}/{repoName}/blob/{commitSha}/{upstreamPath})，遵循 Apache License 2.0。
> 社区翻译，非官方内容；以英文原文为准。发现错误？[在 GitHub 报告](https://github.com/{ourRepo}/issues/new?title=翻译问题%3A+{encodedPath}&body=文件%3A+{encodedPath}%0A问题描述%3A+)
```

---

## 配置文件格式

### config/projects.yaml

```yaml
projects:
  - id: gemini-cli
    name: Gemini CLI
    owner: google-gemini
    repo: gemini-cli
    branch: main
    docsPath: docs/
    route: /gemini-cli/
    upstreamUrl: https://github.com/google-gemini/gemini-cli/tree/main/docs
    license: Apache-2.0

  - id: codex
    name: Codex CLI
    owner: openai
    repo: codex
    branch: main
    docsPath: docs/
    route: /codex/
    upstreamUrl: https://github.com/openai/codex/tree/main/docs
    license: Apache-2.0
```

### config/providers.yml

```yaml
providers:
  - name: deepseek
    baseUrl: https://api.deepseek.com
    defaultModel: deepseek-v4-flash
    upgradeModel: deepseek-v4-pro
    upgradeThresholdTokens: 1200
    envKey: DEEPSEEK_API_KEY

  - name: openrouter
    baseUrl: https://openrouter.ai/api/v1
    defaultModel: ${OPENROUTER_MODEL}
    envKey: OPENROUTER_API_KEY
    optional: true
```

### config/glossary.yml

```yaml
terms:
  - source: agent
    target: 智能体
    note: agent 工具链的固定术语，禁用"代理"

  - source: sandbox
    target: 沙箱

  - source: tool use
    target: 工具调用

  - source: context window
    target: 上下文窗口

  - source: prompt
    target: 提示词

  - source: streaming
    target: 流式输出

  - source: token
    target: token
    note: 保留英文缩写

  - source: fine-tuning
    target: 微调

  - source: grounding
    target: 接地

  - source: multimodal
    target: 多模态
```

---

## 重试与降级策略

| 错误类型 | 处理方式 |
|---|---|
| HTTP 429（限流） | 指数退避，基数 2s，最多 5 次（`p-retry`） |
| HTTP 5xx | 指数退避，基数 1s，最多 3 次 → 切换至下一提供商 |
| 网络 / 超时 | 每次超时 5s，最多 3 次 → 切换至下一提供商 |
| 输出为空 | 以相同提示词重试一次 |
| Markdown 解析失败 | 在提示词末尾追加"仅输出原始 Markdown"约束后重试一次 |
| 术语表违规 | 将违规术语列于提示词开头后重试一次 |
| 缺少锚点 | 强调锚点规则后重试一次 |

降级链（按顺序）：
1. DeepSeek `deepseek-v4-flash`
2. DeepSeek `deepseek-v4-pro`（结构性失败后的重试）
3. OpenRouter（已配置 `OPENROUTER_API_KEY` 时）
4. 放弃：`status: failed`，以英文原文作占位符，记录到 `state/{projectId}.json#failedBlocks`

---

## npm 脚本

```json
{
  "scripts": {
    "sync":          "tsx scripts/sync.ts",
    "sync:full":     "tsx scripts/sync.ts --full",
    "qa":            "tsx scripts/qa.ts",
    "build":         "vitepress build docs",
    "dev":           "vitepress dev docs",
    "preview":       "vitepress preview docs",
    "test":          "vitest run",
    "test:watch":    "vitest",
    "typecheck":     "tsc --noEmit",
    "lint":          "eslint . && prettier --check .",
    "fix":           "eslint . --fix && prettier --write ."
  }
}
```

`scripts/sync.ts` 的 CLI 参数：
- `--project <id>` —— 仅同步指定项目
- `--full` —— 强制全量重新翻译（忽略缓存）

---

## 任务序列

每个任务须通过其验收条件后，方可开始下一个。人工审查员在每个任务完成后确认。

---

### 任务 01 — 项目脚手架

**目标**：创建仓库骨架，使 `pnpm install` 和 `pnpm typecheck` 能够正常运行。

**需创建的文件**：
- `package.json` —— 包含 `01-tech-stack.md` 中的所有依赖；`"license": "MIT"`
- `tsconfig.json` —— `strict: true`，`noUncheckedIndexedAccess: true`，`target: ES2022`，`module: NodeNext`
- `.nvmrc` —— `22`
- `.gitignore` —— node_modules、dist、.env*、state/、translation-memory/、docs/gemini-cli/、docs/codex/、docs/.vitepress/dist/
- `.gitattributes` —— `* text=auto eol=lf`
- `.env.example` —— DEEPSEEK_API_KEY、OPENROUTER_API_KEY、GITHUB_TOKEN
- `LICENSE` —— MIT，年份 2026，持有人：OpenDocs-CN Contributors
- `vitest.config.ts` —— 最小配置，指向 `tests/`
- `eslint.config.js` —— @typescript-eslint/recommended + prettier
- `.prettierrc` —— singleQuote: true，semi: false，printWidth: 100

**验收条件**：
```bash
pnpm install      # 无错误
pnpm typecheck    # 暂无源码；tsc 不得对配置文件报错
pnpm lint         # 无错误（暂无源码）
```

---

### 任务 02 — 配置层

**目标**：启动时加载并验证所有 YAML 配置文件；配置无效时快速失败并给出清晰错误信息。

**需创建的文件**：
- `config/projects.yaml` —— 两个项目（如上）
- `config/providers.yml` —— DeepSeek + OpenRouter（如上）
- `config/glossary.yml` —— 初始 10 个术语（如上）
- `src/config/schema.ts` —— Zod Schema：`ProjectConfigSchema`、`ProviderConfigSchema`、`GlossaryEntrySchema`
- `src/config/loader.ts` —— `loadConfig(): Config`，使用 `yaml` + Zod；验证失败时抛出异常
- `tests/config/loader.test.ts`

**验收条件**：
```bash
pnpm typecheck
pnpm test tests/config/
# 单元测试：loadConfig() 返回类型化配置且不抛出异常
# 单元测试：loadConfig() 在 YAML 不合规时抛出 Zod 错误
```

---

### 任务 03 — GitHub 同步

**目标**：获取上游 docs/ 文件树和原始内容；通过追踪每个文件的 SHA 来检测变更。

**需创建的文件**：
- `src/sync/github.ts` —— `fetchFileTree`、`fetchFileContent`、`fetchLicenseFiles`（使用 `@octokit/rest`）
- `src/sync/state.ts` —— `readState`、`writeState`（操作 `state/{projectId}.json`）
- `src/translation/types.ts` —— 以上"模块规格"中的所有类型
- `tests/sync/github.test.ts` —— 模拟 Octokit 响应

**验收条件**：
```bash
pnpm typecheck
pnpm test tests/sync/
# 单元测试（已模拟）：fetchFileTree 返回形状正确的 FileEntry[]
# 单元测试：readState / writeState 可正确往返序列化
# 手动冒烟测试（需要 GITHUB_TOKEN 或公共 API）：
#   tsx -e "import {fetchFileTree} from './src/sync/github.ts'; console.log(await fetchFileTree(...))"
```

---

### 任务 04 — Markdown 分块器

**目标**：将 `.md` 文件解析为带有正确锚点提示和上下文字段的类型化 `Block[]`。

**需创建的文件**：
- `src/markdown/slugger.ts` —— 封装 `github-slugger`（在依赖中添加）；导出 `slugify(text: string): string`
- `src/markdown/splitter.ts` —— `splitFile(markdown: string, filePath: string): Block[]`
- `tests/markdown/splitter.test.ts`
- `tests/fixtures/sample.md` —— 包含标题、段落、代码块、表格、列表的测试固件

**验收条件**：
```bash
pnpm typecheck
pnpm test tests/markdown/splitter.test.ts
# 单元测试：
#   - 给定测试固件，返回正确数量的块
#   - heading 块有正确的 anchorHint（如 "## Installation" → "installation"）
#   - 代码块的 translatable 为 false
#   - frontmatter 块的 translatable 为 false
#   - prevBlockSource / nextBlockSource 设置正确
#   - 已有 {#custom-slug} 的标题被原样保留（不生成新的 anchorHint）
```

---

### 任务 05 — 翻译记忆库

**目标**：将翻译持久化到 SQLite 并能检索；强制缓存键唯一性约束。

**需创建的文件**：
- `src/translation/memory.ts` —— `TranslationMemory` 类，含 `get`、`set`、`markFailed`、`close`
- `tests/translation/memory.test.ts`

**验收条件**：
```bash
pnpm typecheck
pnpm test tests/translation/memory.test.ts
# 单元测试：
#   - set 后 get 返回相同的翻译文本
#   - 使用不同 glossary_hash 的 get 返回 null（缓存未命中）
#   - 使用不同 prompt_version 的 get 返回 null
#   - markFailed 将 status 设为 'failed'；后续 get 仍返回该记录（status: 'failed'）
#   - reviewed: true 的条目可通过 get 返回
```

---

### 任务 06 — 术语表引擎

**目标**：给定块原文和完整术语表，仅返回匹配的条目；将其渲染为 YAML 注入提示词。

**需创建的文件**：
- `src/translation/glossary.ts` —— `matchGlossary(source, glossary): GlossaryEntry[]`；`renderGlossaryYaml(entries): string`；`computeGlossaryHash(entries): string`
- `tests/translation/glossary.test.ts`

**验收条件**：
```bash
pnpm typecheck
pnpm test tests/translation/glossary.test.ts
# 单元测试：
#   - 原文含 "agent" → 匹配术语表条目（词界匹配，大小写不敏感）
#   - 原文含 "reagent" → 不匹配 "agent" 条目（词界已强制执行）
#   - 某条目的 target 变更后，glossary hash 发生变化
#   - 渲染的 YAML 与预期格式一致
```

---

### 任务 07 — 提示词构建器

**目标**：从 `TranslationRequest` 生成标准提示词字符串；暴露 `PROMPT_VERSION`。

**需创建的文件**：
- `src/translation/prompt.ts` —— `buildPrompt(req, glossaryEntries): string`；`export const PROMPT_VERSION = 'v1.0.0'`

**验收条件**：
```bash
pnpm typecheck
# 手动验证：检查 buildPrompt 对示例请求的输出
# 检查：输出中包含所有 8 条 [RULES]
# 检查：[PREVIOUS BLOCK] 和 [NEXT BLOCK] 标注了"仅供上下文，请勿翻译"
# 检查：PROMPT_VERSION = 'v1.0.0'
```

---

### 任务 08 — LLM 提供商

**目标**：实现 `DeepSeekProvider` 和 `OpenRouterProvider`；两者均满足 `TranslationProvider` 接口。

**需创建的文件**：
- `src/translation/providers/interface.ts` —— `TranslationProvider` 接口
- `src/translation/providers/deepseek.ts` —— 使用 `openai` SDK，`baseURL: 'https://api.deepseek.com'`；支持 flash 和 pro 两个模型
- `src/translation/providers/openrouter.ts` —— 使用 `openai` SDK，`baseURL: 'https://openrouter.ai/api/v1'`

**验收条件**：
```bash
pnpm typecheck
# 集成测试（需要 DEEPSEEK_API_KEY）：
#   tsx -e "
#     import {DeepSeekProvider} from './src/translation/providers/deepseek.ts'
#     const p = new DeepSeekProvider(process.env.DEEPSEEK_API_KEY)
#     console.log(await p.healthCheck())
#     console.log(await p.translate('Translate: Hello world', 100))
#   "
```

---

### 任务 09 — 翻译引擎

**目标**：编排缓存查找 → 提供商调用 → QA 检查 → 重试 → 降级 → 记忆库写入。

**需创建的文件**：
- `src/translation/engine.ts` —— `translateBlock(req, providers, memory): Promise<TranslationResponse>`
- `src/translation/qa.ts` —— 全部 8 项结构校验；返回 `{ passed: boolean; failures: string[] }`
- `tests/translation/qa.test.ts`

**验收条件**：
```bash
pnpm typecheck
pnpm test tests/translation/qa.test.ts
# qa.ts 单元测试：
#   - 代码围栏数量不匹配 → codeFenceCount 检查失败
#   - 译文中 URL 与原文不同 → urlCount 检查失败
#   - 译文中缺少术语目标词 → glossaryTerms 检查失败
#   - 代码围栏内容与原文不同 → 从原文恢复（修复，不重试）
# 集成测试（需要 DEEPSEEK_API_KEY）：
#   - 翻译一个块 → response.status === 'ok'
#   - 再次翻译同一块 → response.cacheHit === true
```

---

### 任务 10 — Markdown 组装器

**目标**：从 `Block[]` 和翻译映射重建完整的翻译后 Markdown 文件。

**需创建的文件**：
- `src/markdown/assembler.ts` —— `assembleFile(blocks, translations, meta): string`
- `tests/markdown/assembler.test.ts`

**验收条件**：
```bash
pnpm typecheck
pnpm test tests/markdown/assembler.test.ts
# 单元测试：
#   - 不可翻译的块（code、thematicBreak）与原文字节一致
#   - heading 块追加了 {#slug}，如 "## 安装 {#installation}"
#   - 上游已有 {#custom} 的标题被原样保留
#   - 输出是合法 Markdown（remark-parse 不抛出异常）
```

---

### 任务 11 — 管道运行器

**目标**：单项目完整端到端同步：拉取 → 差异比对 → 分块 → 翻译 → 组装 → 写入。

**需创建的文件**：
- `src/pipeline/runner.ts` —— `syncProject(projectId: string, opts: SyncOptions): Promise<void>`
- `src/pipeline/writer.ts` —— `writeTranslatedFile(params): Promise<void>`

**`SyncOptions`**：
```ts
interface SyncOptions {
  full?: boolean      // 强制重新翻译所有块（忽略缓存）
  dryRun?: boolean    // 翻译但不写入磁盘
}
```

**验收条件**：
```bash
pnpm typecheck
# 集成测试（需要 DEEPSEEK_API_KEY + 网络）：
#   DEEPSEEK_API_KEY=sk-xxx tsx scripts/sync.ts --project gemini-cli
# 预期结果：
#   - docs/gemini-cli/ 目录填充了翻译后的 .md 文件
#   - 每个文件末尾有归属 footer
#   - state/gemini-cli.json 更新了 lastSyncTime 和 lastSyncSha
#   - translation-memory/gemini-cli.sqlite 存在且有数据行
# 立即重新运行：
#   - 日志显示 cacheHitCount == translatedCount（零 LLM 调用）
```

---

### 任务 12 — VitePress 配置

**目标**：`pnpm dev` 能启动；主页显示两个项目卡片；各项目侧边栏正常渲染。

**需创建的文件**：
- `docs/.vitepress/config.ts` —— 多侧边栏、基础配置、启用内置搜索
- `src/vitepress/sidebar.ts` —— `generateSidebar(projectId): DefaultTheme.SidebarItem[]`；读取 docs/{projectId}/ 目录树
- `docs/index.md` —— 主页：fold 上方显示非官方免责声明 + 两个项目卡片
- `docs/gemini-cli/index.md` —— 占位页，含 `::: warning 非官方翻译 :::` 块
- `docs/codex/index.md` —— 同上
- `docs/public/licenses/gemini-cli/LICENSE.txt` —— 占位（任务 14 填充真实内容）
- `docs/public/licenses/codex/LICENSE.txt` —— 同上

**验收条件**：
```bash
pnpm dev
# 在浏览器中手动检查：
#   - 主页正常加载；"社区中文翻译 · 非官方"在 fold 上方可见
#   - 两个项目卡片可见且可点击
#   - /gemini-cli/ 显示警告块
#   - /codex/ 显示警告块
#   - 侧边栏正常渲染（任务 11 填充内容前可为空）
pnpm build
# 必须无错误完成
```

---

### 任务 13 — CLI 入口

**目标**：`pnpm sync`、`pnpm sync --project gemini-cli`、`pnpm sync --full` 和 `pnpm qa` 均能正确运行。

**需创建的文件**：
- `scripts/sync.ts` —— commander CLI；调用 `syncProject`；处理 `--project` 和 `--full` 参数
- `scripts/qa.ts` —— 对所有翻译文件运行 QA 检查；任一检查失败则以退出码 1 退出

**验收条件**：
```bash
pnpm typecheck
# 冒烟测试：
pnpm sync --project gemini-cli      # 同步单个项目
pnpm sync --project codex           # 同步另一个项目
pnpm qa                             # 所有检查通过则退出码 0；报告违规项
pnpm sync --full --project gemini-cli  # 重新翻译所有块（忽略缓存）
```

---

### 任务 14 — 合规产物

**目标**：从上游拉取真实的 LICENSE/NOTICE；运行 6 项部署前检查清单。

**需实现的内容**：
- 在 `src/sync/github.ts` 中实现已声明的 `fetchLicenseFiles`
- 在 `src/pipeline/runner.ts` 中：同步完成后，将 license 文件复制到 `docs/public/licenses/{projectId}/`
- 在 `scripts/sync.ts` 中：写入任何文件前运行部署前检查清单；任一检查失败则中止

**6 项部署前检查清单**（全部通过方可继续）：
1. 每个翻译文件含归属 footer
2. `docs/index.md` 含非官方翻译横幅
3. 每个项目的 `docs/public/licenses/{projectId}/LICENSE.txt` 存在
4. `docs/public/` 中无上游 logo（检查文件名含 `google`、`openai`、`gemini` 的 `.png`、`.svg`、`.jpg`）
5. 仓库根目录 `LICENSE` 文件存在且含 "MIT"
6. `package.json` 的 `license` 字段等于 `"MIT"`

**验收条件**：
```bash
pnpm sync
# 检查：
#   - docs/public/licenses/gemini-cli/LICENSE.txt 含真实 Apache 2.0 文本
#   - docs/public/licenses/codex/LICENSE.txt 含真实 Apache 2.0 文本
#   - pnpm qa 无合规失败报告
# 反向测试：
#   - 临时删除某个翻译文件的 footer 行
#   - pnpm sync 应中止并提示"部署前检查失败"
```

---

### 任务 15 — CI/CD 工作流

**目标**：GitHub Actions 在每个 PR 上运行类型检查 + 格式检查 + 测试；在推送到 main 及定时触发时运行同步 + 构建 + 部署。

**需创建的文件**：

`.github/workflows/ci.yml`：
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
```

`.github/workflows/sync.yml`：
```yaml
name: 同步与部署
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # UTC 02:00 = 北京时间 10:00
  workflow_dispatch:
jobs:
  sync-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable && pnpm install --frozen-lockfile
      - name: 同步与翻译
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm sync
      - name: QA 检查
        run: pnpm qa
      - name: 构建站点
        run: pnpm build
      - name: 部署到 GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/.vitepress/dist
```

**验收条件**：
- 向 main 推送一个小改动 → CI 工作流触发并通过
- YAML 语法有效（GitHub UI 语法检查或 actionlint）

---

### 任务 16 — 集成测试（验收）

**目标**：`00-project-overview.md` 中的全部 8 条验收标准均通过。

| 序号 | 标准 | 验证方法 |
|---|---|---|
| 1 | 全新 checkout + `pnpm sync` → 两个项目完整翻译，VitePress 无错误构建 | `git clone`，设置 API key，`pnpm sync && pnpm build` —— 无报错 |
| 2 | 再次 `pnpm sync`（无上游变更）→ 零 LLM 调用 | 检查 state JSON：`cacheHitCount == translatedCount` |
| 3 | 修改一个段落 → 仅该块触发 LLM | 手动修改一个块的 hash；重新运行；确认日志中仅有 1 次 LLM 调用 |
| 4 | 代码块、行内代码、URL、heading anchor 字节一致 | `pnpm qa` 全部结构检查通过 |
| 5 | 所有术语表条目均被遵守 | `pnpm qa` 报告零 `glossary_violation` |
| 6 | 站点部署到 GitHub Pages 和 Cloudflare Pages 均可访问 | 两个 URL 均可访问；内部链接无 404 |
| 7 | 每个翻译页面含上游 commit-pinned 来源 footer | 随机抽查 5 个页面 |
| 8 | 主页 fold 上方有"社区中文翻译 · 非官方"声明 | 在浏览器中加载主页；无需滚动即可见 |

---

## 核心约束

以下约束不得违反。违反任意一条均视为 bug。

1. **缓存键完整性**：缓存查找始终使用三元组全部三个分量 `(source_hash, glossary_hash, prompt_version)`，禁止仅凭 `source_hash` 查找。
2. **缓存命中零 LLM 调用**：若 `memory.get(key)` 返回 `status: 'ok'` 的非空结果，该块即已完成，不得再调用 API。
3. **代码块内容完整性**：翻译后的代码块内容必须与原文字节一致。若 LLM 修改了内容，`qa.ts` 必须从原文恢复（确定性修复，非重试）。
4. **heading 锚点**：`assembler.ts` 输出的每个翻译标题均须含 `{#原始英文 slug}`，除非上游原文已有自定义 `{#custom-anchor}`。
5. **归属 footer**：`writer.ts` 写入的每个文件末尾必须有归属 footer。此内容在组装后追加，不属于翻译块内容，不得存入翻译记忆库。
6. **不可翻译的块**：`code`、`thematicBreak`、`html`、`yaml`（frontmatter）块始终原样输出。这些块绝不能发送给 LLM。
7. **禁止正则解析 Markdown**：所有 Markdown 变换均使用 unified/remark AST 管道。禁止用字符串替换处理 Markdown（`{#slug}` 追加到序列化后的标题行末尾的情况除外）。
8. **提示词版本纪律**：`PROMPT_VERSION` 的变更须经过审查，是有意识的决定。它会使所有项目的所有缓存翻译失效。禁止在常规重构中顺带 bump。

---

## 验证节奏

**每个任务完成后**：
```bash
pnpm typecheck   # 必须零错误通过
pnpm test        # tests/ 中所有测试必须通过
pnpm lint        # 零警告
```

**任务 11 及之后**：
```bash
pnpm build       # VitePress 构建必须无错误完成
```

**任务 16 完成后**：
- 手动验证全部 8 条验收标准，并在审查评论中记录结果。
