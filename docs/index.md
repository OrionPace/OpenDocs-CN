---
layout: home

hero:
  name: Antigravity Docs 中文
  text: Google Antigravity 文档 · 社区中文整理
  tagline: 面向中文开发者的非官方文档翻译、路线追踪与实践笔记。以官方英文原文为准。
  actions:
    - theme: brand
      text: 开始阅读
      link: /antigravity/
    - theme: alt
      text: 项目背景
      link: /antigravity/migration/from-gemini-cli

features:
  - title: 聚焦 Antigravity
    details: 项目从通用 CLI 文档翻译转向 Antigravity 相关官方文档、公告与开发者工作流整理。
  - title: 谨慎引用官方来源
    details: 每条关键结论尽量回链官方文档或公告；无法核验的内容会明确标记为待确认。
  - title: 中文开发者视角
    details: 在翻译之外补充术语表、迁移说明、常见问题和中文语境下的实践建议。
---

::: warning 非官方项目
本站为社区维护的中文整理/翻译项目，**不属于** Google 或任何上游项目方。内容可能存在滞后或错误；涉及产品状态、价格、许可、API 行为等权威信息时，请以官方英文原文为准。
:::

## 当前维护重点

| 模块                | 状态   | 说明                                                                     |
| ------------------- | ------ | ------------------------------------------------------------------------ |
| Antigravity 概览    | 进行中 | 建立中文入口、术语和阅读路线                                             |
| 官方来源索引        | 进行中 | 收集官网、公告、文档、发布说明链接                                       |
| Gemini CLI 迁移说明 | 进行中 | 归档旧项目背景，梳理后续维护策略                                         |
| 自动同步流水线      | 暂停   | 旧流水线面向 GitHub `docs/` 目录；Antigravity 官方文档来源待核验后再适配 |

## 为什么改名

本项目前身为 `OpenDocs-CN`，最初用于同步和翻译 Gemini CLI、Codex CLI 等开发者 CLI 文档。随着维护重心转向 Antigravity，项目名称与结构同步调整为 `antigravity-doc-zh`，避免继续混入 Codex 或已不再作为主线的 Gemini CLI 内容。

## 许可证

- **基础设施代码**：MIT，见仓库根目录 `LICENSE`。
- **翻译/整理内容**：除非页面另有说明，遵循对应官方原文的许可与合理引用边界。
