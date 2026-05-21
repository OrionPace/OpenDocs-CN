# Antigravity Docs 中文

Google Antigravity 相关官方文档、公告与开发者工作流的社区中文整理项目。

> 非官方项目：本仓库不属于 Google 或任何上游项目方。产品状态、功能、价格、许可与 API 行为等权威信息，请以官方英文原文为准。

## 项目背景

本项目前身为 `OpenDocs-CN`，最初用于自动同步和翻译 Gemini CLI、Codex CLI 等开发者 CLI 的英文文档。

随着项目维护重心转向 Antigravity，本仓库改名为 `antigravity-doc-zh`，并做如下调整：

- 聚焦 Antigravity，不再混入 Codex；
- Gemini CLI 相关内容进入迁移说明和历史归档；
- 官方来源先核验再翻译，避免传播未经确认的信息；
- 原有 GitHub `docs/` 自动同步流水线暂时保留，后续视 Antigravity 文档来源再改造。

## 当前内容

- 文档首页：`docs/index.md`
- Antigravity 入口：`docs/antigravity/index.md`
- 概览：`docs/antigravity/overview.md`
- Quickstart：`docs/antigravity/quickstart.md`
- 迁移说明：`docs/antigravity/migration/from-gemini-cli.md`
- 官方来源索引：`docs/antigravity/reference/official-sources.md`
- 路线图：`ROADMAP.md`

## 本地开发

```bash
pnpm install
pnpm build
pnpm dev
```

## 维护原则

1. 不写“官方中文文档”；只写“社区中文整理/翻译”。
2. 关键事实必须能追溯到官方来源。
3. 暂不翻译无法确认许可边界的全文内容。
4. 不在本项目中继续维护 Codex CLI 文档。

## License

基础设施代码使用 MIT License。翻译/整理内容遵循对应官方原文的许可与合理引用边界。
