# Antigravity 概览

> 非官方中文整理。以下内容基于 `antigravity.google` 公开页面与页面中可见资料整理；产品状态、功能、价格与条款请以官方页面为准。

## 一句话理解

Google Antigravity 是 Google 面向“agent-first era”的智能体开发平台。官方页面将其描述为：

> Google Antigravity is our agentic development platform, allowing anyone to build in the agent-first era.

中文可以理解为：Antigravity 不只是一个代码补全工具，而是一个围绕**智能体、项目、工作区、后台任务和开发者工作流**组织起来的平台。

## 当前核心组成

根据公开页面，Antigravity 当前至少包含四个重要形态：

| 模块            | 官方页面中的定位                    | 中文理解                 |
| --------------- | ----------------------------------- | ------------------------ |
| Antigravity 2.0 | 管理多个本地智能体的 command center | 多智能体任务中枢         |
| Antigravity CLI | terminal-first surface              | 面向终端的轻量入口       |
| Antigravity SDK | prototype custom agents             | 自定义智能体原型开发工具 |
| Antigravity IDE | fully-featured, agentic IDE         | 完整的智能体 IDE         |

## 2.0 的重点变化

官方首页对 Antigravity 2.0 的描述强调：

- 并行管理多个本地智能体；
- 将对话组织为 Projects；
- 跨多个 workspaces 操作；
- 用 scheduled messages 自动化例行任务。

这说明 Antigravity 2.0 的重点不是单次问答，而是把 AI 编程助手升级为一种**持续运行、可编排、可管理的开发工作台**。

## 适合谁关注

### 个人开发者

如果你已经在使用 Claude Code、Codex、Gemini CLI、OpenCode 等 coding agent，Antigravity 值得重点关注，因为它把 IDE、CLI、后台子智能体和项目级管理放在同一产品线里。

### 团队/企业开发者

官方页面提到 Antigravity 2.0 与 Gemini Enterprise Agent Platform、Google Cloud 项目集成、消费型 API 计费等方向，说明企业版会更强调管理、权限、合规和组织级接入。

### 研究/科学计算场景

官方用例中还出现 science 场景，提到智能体可接触研究者常用工具、模型和数据库。这个方向对公共卫生、医学信息学、科研自动化也值得后续跟踪。

## 和 Gemini CLI 的关系

本项目原本关注 Gemini CLI 等开源 CLI 文档。现在维护重心转向 Antigravity，原因是 Antigravity 已成为 Google 开发者智能体工具路线中更完整、更集中的产品入口。

但在没有官方明确声明前，本文档不直接断言“Gemini CLI 已停止维护”。更稳妥的说法是：

> 本项目的中文文档维护重心从 Gemini CLI 转向 Antigravity；Gemini CLI 后续状态以官方仓库和公告为准。

## 后续文档计划

- [Quickstart](./quickstart.md)
- CLI 使用说明
- IDE 使用说明
- SDK 使用说明
- 企业版 / Gemini Enterprise 说明
- 从 Gemini CLI 迁移
- 与 Claude Code / Codex / OpenCode 的差异
