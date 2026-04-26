# Implementation Plan — OpenDocs-CN

> **本文是后续 agent（包括切换模型后）继续工作的唯一权威入口。**
>
> 阅读顺序：本文件 → `task.md`（具体下一步动作）→ `.claude/rules/`（详细约束）。
>
> 文档版本：2026-04-26（对应代码 commit `ebf138f`，v2 架构首次完整 sync 后）

---

## 1. 项目目标（一句话）

自动同步 `google-gemini/gemini-cli` 与 `openai/codex` 的英文 `docs/` → 用 LLM 翻译成中文 → 通过 VitePress 发布到 `https://orionpace.github.io/OpenDocs-CN/`。

**Phase 1 验收标准（八条 / 当前状态）**：

| # | 标准 | 状态 |
|---|---|---|
| 1 | `pnpm sync` 全跑通，VitePress 无错误构建 | ⚠️ sync ✅ build ❌（telemetry.md HTML 炸） |
| 2 | 二次 sync 零 LLM 调用 | ❓ 未验证（需 build 成功后跑第二次） |
| 3 | 单文件变更 → 仅该文件触发 LLM | ❓ 未验证 |
| 4 | 代码 / URL / 锚点逐字节一致 | ⚠️ 大部分 ✅，HTML 闭合是 v2 已知风险 |
| 5 | `pnpm qa` 零 glossary_violation | ❌ gemini-cli 有 10 个 glossary 失败（已写英文占位） |
| 6 | GitHub Pages 可访问 + 自动部署 | ❌ build 挂导致 deploy 没跑（404） |
| 7 | 每页 footer 含 commit-pinned 链接 | ✅ writer 实现了，待 build 后验证 |
| 8 | 首页"社区中文翻译 · 非官方" | ✅ predeploy:check 通过 |

---

## 2. 当前架构（v2，2026-04-25 重构）

### 翻译单元

- **整个文件**作为一个 LLM 调用单元
- 文件 > 25 KB 时按 H2 边界切分，每段独立调用（仅极少数大文件触发）
- v1 的 paragraph-level / block-level / AST splitter / anchor injector **已全部删除**（commit `e8ac609`）

### 关键代码路径

| 文件 | 职责 |
|---|---|
| `src/translation/chunker.ts` | `chunkFile(source)` 按 25 KB 阈值 + H2 切分；`joinChunks()` 重组 |
| `src/translation/prompt.ts` | `PROMPT_VERSION='v2.0.0'` + `buildPrompt(req, glossary)` |
| `src/translation/engine.ts` | `translateChunk()`：cache → provider 链 → QA → stricter retry → next provider → fail open |
| `src/translation/file-qa.ts` | regex 计数：fences / 行内 code / URL / heading / `{#anchor}` / 术语表 |
| `src/translation/memory.ts` | SQLite UNIQUE `(source_hash, glossary_hash, prompt_version)` |
| `src/translation/providers/{nvidia-nim,deepseek,openrouter}.ts` | OpenAI SDK 适配，`timeout: 60_000` 写死 |
| `src/pipeline/runner.ts` | 端到端：fetch tree → pLimit 并发翻译 → 写文件 + footer → 更新 state |
| `src/pipeline/writer.ts` | 注入页脚署名 + 落地页"非官方"warning |
| `scripts/sync.ts` | commander CLI（`--project` `--full` `--concurrency`） |
| `scripts/predeploy-check.ts` | 8 项合规检查 |
| `.github/workflows/sync.yml` | sync → fetch-licenses → predeploy → build → deploy |

### Provider 链（`config/providers.yml`）

| # | 名称 | base_url | model | env | 状态 |
|---|---|---|---|---|---|
| 1 | nvidia-nim | `https://integrate.api.nvidia.com/v1` | `deepseek-ai/deepseek-v4-flash` | `NVIDIA_API_KEY` | **必需**（free） |
| 2 | deepseek | `https://api.deepseek.com` | `deepseek-v4-flash` | `DEEPSEEK_API_KEY` | optional |
| 3 | openrouter | `https://openrouter.ai/api/v1` | `$OPENROUTER_MODEL` | `OPENROUTER_API_KEY` | optional |

**禁用：** `deepseek-v4-pro`（用户拒绝）。重试只用 stricter prompt + 同 flash 模型。

### 数据持久化（必须进 git）

- `state/{project-id}.json` — 同步状态（CI 每次 sync 自动 commit & push）
- `translation-memory/{project-id}.sqlite` — 翻译缓存（同上）

`docs/gemini-cli/` 与 `docs/codex/` **gitignored**（runtime 生成）。

---

## 3. 已完成（按时间倒序）

### 2026-04-26：v2 首次完整 sync 跑通（commit `ebf138f`）

- gemini-cli 91 文件 → 80 成功翻译 + 11 失败（10 glossary + 1 headingCount + 1 truncated）
- codex 22 文件 → 全部成功
- translation-memory + state 自动 push 回 main
- **build 失败** 在 `docs/gemini-cli/cli/telemetry.md:801` `Element is missing end tag`

### 2026-04-25：v2 架构重构（commit `e8ac609`）

替换 v1 paragraph-level → file-level：

- 删除：`src/markdown/{splitter,assembler,slugger}.ts`、`src/translation/qa.ts`、对应 tests、所有 v1 状态/缓存
- 新增：`src/translation/chunker.ts`、`src/translation/file-qa.ts`
- 重写：`engine.ts`、`prompt.ts`、`runner.ts`、所有 provider、`types.ts`、相关 tests
- 估算：API 调用 3000 → 113，首次 sync 时间 60+ min → 10-20 min

### 此前（v1 阶段）

| Task | 产出 |
|---|---|
| 01 Project Scaffold | `package.json` `tsconfig` `.nvmrc=22` `.gitignore` `.gitattributes` `LICENSE`(MIT) |
| 02 Config Layer | `config/{projects,providers,glossary}.{yaml,yml}` + Zod schema |
| 03 GitHub Sync | `src/sync/{github,state}.ts`（Octokit） |
| 05 Translation Memory | `src/translation/memory.ts`（构造函数里求值 dir，避开 chdir 测试污染） |
| 06 Glossary | `src/translation/glossary.ts`（词边界 + hash + YAML render） |
| 08 LLM Providers | nvidia-nim / deepseek / openrouter，60s timeout 写死 |
| 11 Pipeline | `src/pipeline/{runner,writer}.ts`，pLimit 文件 + chunk 并发 |
| 12 VitePress | `docs/.vitepress/config.ts`（base=`/OpenDocs-CN/`）+ homepage + sidebar |
| 13 CLI | `scripts/{sync,qa}.ts` |
| 14 Compliance | `scripts/{fetch-licenses,predeploy-check}.ts`（8 项检查） |
| 15 CI/CD | `.github/workflows/{sync,ci}.yml`（exit code 2 = soft fail OK） |
| 16 Tests | 42/42 passing，`pool: 'forks'` for chdir |

### 关键修复（commits 倒序）

- `b8416f1` — runner 不再仅写 changed 文件，**总是**写所有 tree 文件
- `14c6fa1` — 修首页文案 `中文社区翻译` → `社区中文翻译`（predeploy:check 词序敏感）
- `57783b8` — sync exit code 2（block-level fail open）视为 soft success
- `70ed4ec` — 修真正的 file parallelism，移除 fake state 种子数据

---

## 4. 当前阻塞与根因分析

### 阻塞 1：VitePress build 挂在 `docs/gemini-cli/cli/telemetry.md:801` `Element is missing end tag`

**根因：** `src/translation/file-qa.ts` 现有检查：fenced code count、inline code count、URL count、heading count、`{#anchor}` count、glossary terms。**没有 HTML 标签平衡检查**。LLM 输出整个文件时偶发漏掉 `</details>` `</summary>` `</div>` 之类闭合标签 → QA 不报错 → 译文进 docs/ → Vue compiler 在 VitePress build 时炸。

**为什么 v1 没遇到：** v1 paragraph-level 把 HTML block 整块标记 `translatable: false` 原样保留。v2 file-level 让 LLM 看到整个文件包括 HTML，给了破坏空间。

### 阻塞 2：11 个失败文件用英文源占位

按设计，failed → 英文源占位 + state 标记 failed。这些**不阻塞 deploy**（这 11 个页面是英文，其余 102 个是中文），但拖累验收 #5。

failed 文件清单（来自 `state/gemini-cli.json#failedFiles`）：

| 文件 | 失败原因 |
|---|---|
| `docs/changelogs/latest.md` | glossary × 3 |
| `docs/cli/enterprise.md` | headingCount |
| `docs/cli/themes.md` | glossary |
| `docs/CONTRIBUTING.md` | glossary |
| `docs/core/remote-agents.md` | glossary |
| `docs/examples/proxy-script.md` | glossary |
| `docs/reference/configuration.md` | output truncated（max_tokens=8000 不够） |
| `docs/reference/policy-engine.md` | headingCount + glossary |
| `docs/resources/quota-and-pricing.md` | glossary |
| `docs/tools/todos.md` | glossary |

注意：所有失败的 fail message 都标 `deepseek:` —— 这意味着 NVIDIA NIM 先尝试失败，然后 fallback 到 DeepSeek 再失败。说明 fallback 链工作正常。

### Workflow 已知小问题（不阻塞）

- `actions/checkout@v4` 等 Node 20，2026-09-16 后会被强制升级（warning）
- `output truncated`：max_tokens=8000 + ~25 KB chunk 阈值偶尔不够。可让 chunker 在更小阈值切分

---

## 5. 下一步路线图

详细可执行步骤见 `task.md`。整体顺序：

### Step A — 解封 build（**当前 task.md 的内容**，30-90 分钟）

1. 在 `src/translation/file-qa.ts` 增加 **HTML 标签平衡检查**：用 regex 计数 `<tag>` 和 `</tag>`，每个 tag 名称的 open / close 数量必须一致（自闭合标签 `<br/>` `<img />` 跳过）
2. 加这条检查时**不要**bump `PROMPT_VERSION`（prompt 没变，只是 QA 更严格；新检查会让"看似成功但 HTML 坏"的译文落到下一个 provider，最终落到英文源占位）
3. 给 11 个已失败文件 + telemetry.md 重新触发：`pnpm sync --project gemini-cli`（NIM 免费，cache hit 90+ 个文件，只重试少数失败的）
4. 验证 `pnpm build` 成功
5. push → GitHub Actions 跑完 deploy → 验证 `https://orionpace.github.io/OpenDocs-CN/` 200

### Step B — 收敛失败文件（提升验收 #5，可选）

10 个 glossary 失败的文件，逐文件查上游真实内容判断：

- 上游本身只是代码片段密集 / 短小 → 加术语表豁免规则或排除该路径
- LLM 真的漏译 → 调整 `glossary.yml` 中的 `note` 字段，加强 prompt 强调

`docs/reference/configuration.md` truncated → 在 chunker 把阈值从 25 KB 调到 15 KB 让它切两段，或专门为该文件加显式切分点。

### Step C — 验证缓存（验收 #2、#3）

二次 `pnpm sync` 不带 `--full`，确认 0 LLM 调用。
本地修改某文件 1 个段落（push 到 fork）→ 仅该文件触发 LLM。

### Step D — 验证字节一致（验收 #4）

写脚本 / 增强 `pnpm qa`：对照 source / translated 的 fenced code 内容**逐字节**比较（v2 没有 v1 的 `restoreCodeFences` 确定性修复）。如发现差异 → 加 deterministic restore。

### Step E — 部署可用性收尾

Cloudflare Pages 镜像（可选）；监控首次部署后访问情况。

---

## 6. 进入项目时的检查清单

切换 agent / 模型时，第一步：

```bash
git status                                       # 工作树状态
git log --oneline -5                             # 最近 commits
gh run list --repo OrionPace/OpenDocs-CN -L 3    # 最近 CI 状态
cat task.md                                      # 当前下一步
```

如果 `task.md` 中标注的"目标 commit"与 `git log` 不一致，说明已有进展，**先把 task.md 更新再开始干活**。

---

## 7. 文件地图

```
.claude/rules/
  00-project-overview.md   ← 项目"是什么"
  01-tech-stack.md         ← 版本、Provider 配置、跨平台约束
  03-translation-rules.md  ← 翻译时硬约束（v2）
  04-compliance.md         ← 合规、署名、预部署清单

implementation_plan.md     ← 本文件（进 git）
task.md                    ← 当前下一步（gitignored）

src/
  config/{schema,loader}.ts
  sync/{github,state}.ts
  translation/
    {types,memory,prompt,glossary,chunker,file-qa,engine}.ts
    providers/{interface,nvidia-nim,deepseek,openrouter}.ts
  pipeline/{runner,writer}.ts
  vitepress/sidebar.ts

scripts/{sync,qa,fetch-licenses,predeploy-check}.ts
config/{projects.yaml,providers.yml,glossary.yml}
docs/.vitepress/config.ts、index.md、about/
state/、translation-memory/  ← 进 git，CI 自动提交
.github/workflows/{sync,ci}.yml
```

---

## 8. 核心不变量（永远不要违反）

1. **缓存键三元组** `(source_hash, glossary_hash, prompt_version)` 永远是 SQLite UNIQUE。修 prompt → bump `PROMPT_VERSION`。
2. **`state/` 与 `translation-memory/` 进 git**，CI 自动 commit。本地修改前先 `git pull`。
3. **`docs/gemini-cli/`、`docs/codex/` 不进 git**（`.gitignore`）。永远不要 `git add docs/gemini-cli/`。
4. **OpenAI SDK timeout** 全部 provider 写死 60s。永远不要改回默认 600s（曾导致 4 小时挂起）。
5. **禁止 `deepseek-v4-pro`**（用户拒绝）。重试只用 stricter prompt + 同 flash。
6. **首页字符串** 必须含"社区中文翻译"（词序敏感，predeploy:check 强制）。
7. **failed 文件** 的 placeholder 是英文源文，不是空字符串。这保证 build 至少能跑（除非 HTML 闭合炸）。

---

## 9. 历史决策（避免被重新讨论）

- TS 而非 Python：VitePress + 构建链都是 JS
- pnpm 而非 npm/yarn：speed + workspaces ready
- better-sqlite3 而非 JSON：translation memory 会 10k+ 行
- VitePress 而非 Docusaurus / Rspress：体积最小 + 中文渲染最干净 + 用户指定
- v2 file-level 而非 v1 paragraph-level：90%+ token 节省（prompt 模板开销） + 整个文件做上下文质量更好；代价是 HTML 损坏风险（已知，正在加 QA 检查）
- NVIDIA NIM 优先而非 DeepSeek：用户有免费配额
