# Quickstart：开始使用 Antigravity

> 状态：初稿。下载地址、系统要求和账号/套餐信息仍需二次核验，实际操作请以官方页面为准。

## 1. 访问官方入口

当前公开入口：

- 官方主页：https://antigravity.google/
- 下载页：https://antigravity.google/download
- 价格/套餐页：https://antigravity.google/pricing
- Release notes：https://antigravity.google/changelog
- Blog：https://antigravity.google/blog

## 2. 选择使用方式

根据官方页面，Antigravity 可能有三类入口：

1. **Antigravity IDE**：完整 IDE 形态，适合项目级开发。
2. **Antigravity CLI**：终端优先，适合喜欢命令行、远程服务器、自动化任务的开发者。
3. **Antigravity SDK**：面向自定义 agent 原型和评测。

如果你是从 Gemini CLI、Claude Code 或 Codex 迁移过来，建议优先关注：

- CLI 是否能复用你的终端工作流；
- IDE 是否能理解现有代码库；
- Projects / Workspaces 是否适合管理多个任务；
- 后台 subagents 和 scheduled messages 是否能替代你原先的脚本/定时任务。

## 3. 下载平台

官方页面前端逻辑显示下载页会根据用户系统提供不同按钮：

| 系统    | 页面中可见的下载选项 |
| ------- | -------------------- |
| Windows | x64、ARM64           |
| macOS   | Apple Silicon、Intel |
| Linux   | Linux 下载           |

实际下载链接和安装包格式请以 `https://antigravity.google/download` 页面为准。

## 4. 账号与套餐

官方价格页显示了以下层级信息：

- For Individuals：`$0/month`；
- Google AI Pro；
- Google AI Ultra；
- Organization plan via Google Cloud。

其中个人层级页面描述包括模型访问、Tab completions、Command requests 和每周速率限制；组织层级强调 Google Cloud Terms of Service、Google Cloud Project Integration 和 consumption-based API pricing。

这些信息变化风险较高，本文档只做索引，不替代官方价格页。

## 5. 第一次使用建议

1. 先新建一个低风险测试项目，不要直接打开生产仓库。
2. 查看 agent 权限设置，确认它能做什么、不能做什么。
3. 让 agent 先做只读任务：解释代码结构、列出 TODO、生成测试计划。
4. 再逐步允许它修改文件、运行测试、提交 patch。
5. 如果启用后台任务或 scheduled messages，务必确认任务范围和停止方式。

## 6. 安全注意事项

Antigravity 的服务条款页面中提到，服务包含可代表用户执行动作或任务的 AI Agents；用户需要负责判断 agent 是否适合具体用例，并监督其在生产环境中的使用。

因此建议：

- 不要把密钥、生产凭据、真实用户数据直接暴露给 agent；
- 对破坏性命令保持人工确认；
- 使用 Git 分支和 PR 审查 agent 的修改；
- 对企业/科研/医疗相关项目，先确认数据合规边界。

## 7. 下一步

- 阅读 [Antigravity 概览](./overview.md)
- 查看 [官方来源索引](./reference/official-sources.md)
- 阅读 [从 Gemini CLI 到 Antigravity](./migration/from-gemini-cli.md)
