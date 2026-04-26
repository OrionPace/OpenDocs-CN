# 项目概览 — OpenDocs-CN

> **进入项目时先读 `implementation_plan.md`** —— 它给出当前架构、已完成、当前阻塞、下一步。本文件只给出"是什么"。

## 一句话

自动同步上游 GitHub 项目的英文 `docs/` → 用 LLM 翻译成中文 → 通过 VitePress 发布静态站点。

## Phase 1 范围（MVP）

两个项目，仅此而已：

| 项目 | 上游 | 路由 |
|---|---|---|
| Gemini CLI | `google-gemini/gemini-cli` @ `main`，路径 `docs/` | `/gemini-cli/` |
| Codex CLI | `openai/codex` @ `main`，路径 `docs/` | `/codex/` |

部署到 `https://orionpace.github.io/OpenDocs-CN/`（GitHub Pages，子路径 `/OpenDocs-CN/`）。

## Phase 1 验收标准（八条）

`implementation_plan.md` 跟踪每条的当前状态。

1. `pnpm sync` 首次跑通 → 两个项目完整翻译，VitePress 无错误构建
2. 再次 `pnpm sync`（无上游变化）→ 零 LLM 调用
3. 单文件变更 → 仅该文件触发 LLM
4. 代码块 / 行内代码 / URL / 标题锚点逐字节与上游一致
5. `pnpm qa` → 零 glossary_violation
6. 站点可访问 + GitHub Pages 自动部署
7. 每页 footer 含上游 commit-pinned 来源链接
8. 首页首屏有"社区中文翻译 · 非官方"声明

## 不做（Phase 1 非目标）

并排双语 / PR review 流 / 非 Markdown 内容（图片 OCR、MDX、notebook）/ 多版本文档 / 本地 LLM / Algolia 搜索 / UI 多语言切换 / 自定义主题。

## 详细规则

- 技术栈、Provider 配置、跨平台约束：`01-tech-stack.md`
- 翻译时硬约束（v2 文件级架构）：`03-translation-rules.md`
- 合规、署名、预部署清单：`04-compliance.md`
