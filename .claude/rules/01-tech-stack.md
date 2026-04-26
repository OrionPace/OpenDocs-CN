# 技术栈（已锁定）

不要替换以下选择。所有理由已落到代码 / lockfile / 配置中。

## 运行时

- **TypeScript 5.6+**：`strict: true`，`noUncheckedIndexedAccess: true`
- **Node.js 22 LTS**：CI 用 `actions/setup-node@v4` + `node-version-file: .nvmrc`
- **pnpm 9.x**：提交 lockfile，禁止 `npm` / `yarn`

## 静态站点

- **VitePress 1.5+**，默认主题（不 fork），内置本地搜索（不接 Algolia），多侧边栏每项目一份
- 配置文件：`docs/.vitepress/config.ts`（`base: '/OpenDocs-CN/'`）

## Markdown 处理（v2 架构变更 — 与 v1 截然不同）

**v2 不再用 unified/remark AST 切块。** 整个文件（或对超大文件按 H2 切节）作为一个翻译单元送给 LLM，LLM 必须保留全部 Markdown 结构 verbatim。

- 切分逻辑：`src/translation/chunker.ts`
- 结构 QA：`src/translation/file-qa.ts`（regex 计数：fences / 内联 code / URL / heading / `{#anchor}` / 术语表）
- 仍然依赖 `remark-*`、`unified`、`mdast-util-to-string` 的位置：**没有了**（已从 src/markdown/ 删除）

如果未来需要修复 LLM 输出的 Markdown 结构错误，**优先用确定性 regex 修复**（如 v1 的 `restoreCodeFences` 思路），而不是重新引入 AST。

## 存储

- **better-sqlite3 11.x**：`translation-memory/{project-id}.sqlite`
  - 唯一键 `(source_hash, glossary_hash, prompt_version)`，命中即跳过 LLM
- **JSON 同步状态**：`state/{project-id}.json`
- **YAML 配置**：`config/projects.yaml`、`config/providers.yml`、`config/glossary.yml`

`state/` 与 `translation-memory/` **必须进 git**（CI 每次 sync 自动 commit & push 它们，否则下次跑要全量重翻）。

## LLM Providers（按优先级）

详细选项见 `config/providers.yml`。

| # | 名称 | base_url | model | env | 状态 |
|---|---|---|---|---|---|
| 1 | nvidia-nim | `https://integrate.api.nvidia.com/v1` | `deepseek-ai/deepseek-v4-flash` | `NVIDIA_API_KEY` | **必需**（free） |
| 2 | deepseek | `https://api.deepseek.com` | `deepseek-v4-flash` | `DEEPSEEK_API_KEY` | optional |
| 3 | openrouter | `https://openrouter.ai/api/v1` | `$OPENROUTER_MODEL` | `OPENROUTER_API_KEY` | optional |

**禁止：** `deepseek-v4-pro`、`deepseek-chat`、`deepseek-reasoner`（已废弃 / 用户拒绝）。所有 provider 共用 OpenAI SDK 调用，**`timeout: 60_000`** 写死（默认 600s 曾导致 4 小时挂起）。

Provider 接口见 `src/translation/providers/interface.ts`。新增 provider 只需实现该接口并加入 `providers.yml`。

## 关键依赖

```jsonc
{
  "typescript": "^5.6.0",
  "vitepress": "^1.5.0",
  "@octokit/rest": "^21.0.0",
  "better-sqlite3": "^11.0.0",
  "zod": "^3.23.0",
  "yaml": "^2.6.0",
  "openai": "^4.70.0",
  "p-retry": "^6.2.0",
  "p-limit": "^6.1.0",
  "picocolors": "^1.1.0",
  "commander": "^12.1.0",
  "dotenv": "^16.4.0"
}
```

Dev：`vitest` `eslint` `@typescript-eslint/*` `prettier` `tsx` `@types/node` `@types/better-sqlite3`。

## CLI 入口（npm scripts）

```
pnpm sync                   # 同步所有项目，cache hit 优先
pnpm sync --project codex   # 单项目
pnpm sync --full            # 强制全量重翻，忽略 cache
pnpm qa                     # 结构 QA，零 LLM 调用
pnpm build / dev            # vitepress build / dev
pnpm test / typecheck / lint / fix
```

## 跨平台 / 环境约束

本项目同时跑在本地 Windows 11 与 CI Ubuntu。强制：

- 禁止 npm scripts 用 shell `&&` 串接、禁止使用 POSIX-only 工具（`sed -i` `find` `xargs`）。要写自动化用 `scripts/*.ts` + `tsx`。
- `path.posix.join()` 或 `node:path` helper，禁止硬编码 `/` 或 `\`。
- 提交 `.gitattributes` 强制 `* text=auto eol=lf`（避免 Windows checkout 破坏 VitePress build）。
- 不创建 / 不跟随 symlink（Windows 需管理员权限）。
- 路径深度保持在 Windows MAX_PATH（260 字符）以内。
- `.env.local`（gitignored）用 `dotenv` 加载。CI 用 GitHub Secrets：`NVIDIA_API_KEY`（必需）、`DEEPSEEK_API_KEY`（可选）、`OPENROUTER_API_KEY`（可选）。
- 不使用本地 GPU 推理（用户机器 RTX 4060/8GB，明确不在范围内）。
- 所有 cron 用 UTC，注释里写北京时间。

## 部署

- **GitHub Pages**：`.github/workflows/sync.yml` 构建并推到 `gh-pages` 分支（或 actions/deploy-pages，视当前 workflow 实现）
- **镜像（可选）**：Cloudflare Pages 连仓库，`main` 推送自动构建
