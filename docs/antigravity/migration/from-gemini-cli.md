# 从 Gemini CLI 到 Antigravity

本页记录项目维护方向从 Gemini CLI 文档翻译转向 Antigravity 中文整理的原因、边界和后续计划。

## 背景

`OpenDocs-CN` 最初面向 Gemini CLI、Codex CLI 等开发者 CLI 文档，采用“同步 GitHub 上游 `docs/` 目录 → LLM 翻译 → VitePress 发布”的模式。

现在项目重命名为 `antigravity-doc-zh`，维护重点转向 Antigravity：

- 不再把 Codex CLI 作为本项目内容；
- Gemini CLI 相关内容进入历史归档/迁移说明；
- 后续围绕 Antigravity 官方文档、公告、发布说明和中文实践笔记组织内容。

## 技术路径变化

旧路径假设上游文档位于公开 GitHub 仓库的 `docs/` 目录，因此可以自动同步 commit SHA 并做增量翻译。

Antigravity 的官方资料来源需要重新核验。如果主要来源是官网文档而不是 GitHub 仓库，项目需要从“GitHub docs 自动同步”调整为：

1. 维护官方来源索引；
2. 手动或半自动抓取可公开访问的官方页面；
3. 为每个页面记录来源 URL、访问日期和许可边界；
4. 再进行中文翻译、摘要和实践补充。

## 迁移策略

- 保留原有翻译流水线代码，暂不删除，后续可改造成官网文档同步器。
- 旧 Gemini CLI / Codex 状态与翻译记忆移动到 `archive/legacy-open-cli/`。
- 新增 `docs/antigravity/` 作为当前文档主入口。
- `config/projects.yaml` 暂时置空，表示没有活动的 GitHub `docs/` 上游项目。

## 待核验事项

- Antigravity 官方文档的主入口 URL；
- 是否存在公开仓库或可稳定引用的文档源；
- 相关内容的版权/许可边界；
- Gemini CLI 后续维护状态与官方迁移建议；
- Antigravity 与 Gemini CLI 在开发者工作流上的差异。
