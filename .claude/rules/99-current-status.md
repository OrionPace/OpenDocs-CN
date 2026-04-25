# 当前项目状态（随里程碑主动更新）

> 本文件是失忆保护机制的核心。无论上下文被压缩多少次，只要加载了 rules/ 目录，就能从这里重建三件事：**目标、已完成、接下来做什么**。
>
> **更新时机**：完成一个重要里程碑、改变技术方向、修复了影响后续工作的关键 bug 时更新。不要在每次对话后都更新。

---

## 目标（未来）

MVP Phase 1 验收标准（全部通过前不算完成）：

1. `pnpm sync` 首次运行 → 两个项目完整翻译，VitePress 无错误构建
2. 再次 `pnpm sync`（无上游变化）→ 零 LLM 调用
3. 单块修改 → 仅该块触发 LLM
4. 代码块/行内代码/URL/标题锚点逐字节与上游一致
5. `pnpm qa` → 零 glossary_violation
6. 站点在 GitHub Pages（`https://orionpace.github.io/OpenDocs-CN/`）可访问
7. 每页 footer 含上游 commit-pinned 来源链接
8. 首页首屏有"社区中文翻译 · 非官方"声明

## 已完成（过去）

### 基础设施 & 配置（Task 01–02）
- `package.json`、`tsconfig.json`、`.nvmrc`（22）、`.gitignore`、`.gitattributes`、`.env.example`、`LICENSE`（MIT）
- `config/projects.yaml`（gemini-cli + codex）
- `config/providers.yml`：NVIDIA NIM（primary，free）→ DeepSeek（optional）→ OpenRouter（optional）
- `config/glossary.yml`（10 个术语）
- `src/config/schema.ts`（Zod 验证）+ `src/config/loader.ts`

### 同步层（Task 03）
- `src/sync/github.ts`：`fetchFileTree`、`fetchFileContent`、`fetchBranchSha`、`fetchLicenseFiles`
- `src/sync/state.ts`：`readState`/`writeState`/`emptyState`

### Markdown 处理（Task 04 + Task 10）
- `src/markdown/splitter.ts`：remark AST → Block[]，slug 去重，non-translatable 检测
- `src/markdown/slugger.ts`：per-file GithubSlugger
- `src/markdown/assembler.ts`：Block[] → Markdown，确定性 `{#anchor}` 补齐

### Translation Memory（Task 05）
- `src/translation/memory.ts`：SQLite WAL，UNIQUE(source_hash, glossary_hash, prompt_version)
- **重要修复**：`MEMORY_DIR` 改为在构造函数里求值，不在模块加载时固定，避免 process.chdir 测试污染

### 词表 + Prompt（Task 06–07）
- `src/translation/glossary.ts`：词边界匹配 + hash + YAML render
- `src/translation/prompt.ts`：`PROMPT_VERSION='v1.0.0'`，标准 8 条规则模板
- `src/translation/types.ts`：所有共享类型

### LLM Providers（Task 08）
- `src/translation/providers/interface.ts`
- `src/translation/providers/deepseek.ts`（只用 flash，无 pro 升级）
- `src/translation/providers/openrouter.ts`
- `src/translation/providers/nvidia-nim.ts`（NVIDIA NIM free endpoint，primary provider）

### Translation Engine + QA（Task 09）
- `src/translation/engine.ts`：cache → non-translatable shortcut → callWithBackoff（p-retry，仅 transport 错误）→ runQA → stricter retry → next provider → mark failed
- `src/translation/qa.ts`：8 项结构检查，`restoreCodeFences` 确定性修复

### Pipeline（Task 11）
- `src/pipeline/runner.ts`：`syncProject` 端到端流水线，p-limit 并发
- `src/pipeline/writer.ts`：写磁盘 + 署名页脚 + 落地页"非官方"警告块

### VitePress（Task 12）
- `docs/.vitepress/config.ts`：base='/OpenDocs-CN/'，多 sidebar，zh-CN 搜索
- `docs/index.md`：主页 + 非官方声明
- `docs/about/index.md`
- `src/vitepress/sidebar.ts`：文件系统驱动侧栏

### CLI（Task 13）
- `scripts/sync.ts`：commander，--project/--full/--concurrency
- `scripts/qa.ts`：结构 QA，无 LLM

### 合规（Task 14）
- `scripts/fetch-licenses.ts`：镜像上游 LICENSE/NOTICE
- `scripts/predeploy-check.ts`：8 项合规检查

### CI/CD（Task 15）
- `.github/workflows/ci.yml`：typecheck + lint + test
- `.github/workflows/sync.yml`：日常同步 + GitHub Pages 部署
- 修复：删除 pnpm 硬编码版本；secrets-in-if 改为 step output 模式

### 测试（Task 16 + 各模块）
- 11 个测试文件，69 个测试，全部通过
- 集成测试覆盖：幂等性、cache hit、landing page footer、代码块字节一致

## 接下来做什么（现在）

**当前优先级：触发首次 sync，验证端到端流水线**

1. ✅ GitHub Pages 已配置为 Actions 模式（build_type: workflow）
2. ✅ NVIDIA_API_KEY Secret 已设置
3. ✅ `base: '/OpenDocs-CN/'` 已加入 VitePress config
4. 🔲 触发 `sync.yml` workflow（手动 dispatch）
5. 🔲 监控运行：sync → fetch-licenses → predeploy:check → vitepress build → deploy
6. 🔲 验证 `https://orionpace.github.io/OpenDocs-CN/` 可访问
7. 🔲 运行 `pnpm qa` 检查译文质量

## 关键技术决策备忘

| 决策 | 原因 |
|---|---|
| NVIDIA NIM 作 primary（免费） | 用户明确要求先白嫖 |
| 只用 deepseek-v4-flash，禁 pro | 用户明确要求，记录在 memory |
| `state/` + `translation-memory/` 从 .gitignore 移除 | CI 需要持久化缓存，否则每次全量重翻 |
| VitePress base = '/OpenDocs-CN/' | GitHub Pages 子路径部署必须 |
| pool: 'forks' in vitest | process.chdir 测试需要进程级隔离 |
