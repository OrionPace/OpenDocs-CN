# 项目概览 — antigravity-doc-zh

## 当前定位

`antigravity-doc-zh` 是 Google Antigravity 相关官方文档、公告和开发者工作流的社区中文整理项目。

- 非官方项目，不代表 Google；
- 产品状态、价格、许可、条款和 API 行为以官方英文原文为准；
- 关键事实需要能追溯到官方来源；
- 项目不再维护 Codex CLI 文档；
- Gemini CLI 相关内容仅作为历史/迁移背景。

## 历史

本项目前身是 `OpenDocs-CN`，曾计划自动同步并翻译 Gemini CLI / Codex CLI 的 GitHub `docs/` 目录。现在仓库已改名为 `OrionPace/antigravity-doc-zh`，维护重点转向 Antigravity。

## 当前结构

| 路径 | 用途 |
| --- | --- |
| `docs/antigravity/` | 当前 Antigravity 中文文档主入口 |
| `docs/antigravity/reference/official-sources.md` | 官方来源索引 |
| `docs/antigravity/migration/from-gemini-cli.md` | 从 Gemini CLI 到 Antigravity 的迁移说明 |
| `archive/legacy-open-cli/` | OpenDocs-CN 阶段遗留状态、翻译记忆和计划 |
| `PROJECT_STATE.md` | 长上下文/换会话恢复现场用的交接文档 |

## 工作原则

1. 先核验来源，再写结论。
2. 不写“官方中文文档”，只写“社区中文整理/翻译”。
3. 不全文搬运许可边界不明的官方页面。
4. 不把 Codex 内容混入本项目。
5. 每完成阶段更新 `PROJECT_STATE.md` 和 `ROADMAP.md`，避免上下文压缩后失忆。
