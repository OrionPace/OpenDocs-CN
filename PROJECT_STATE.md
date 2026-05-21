# Project State / Handoff

> 这个文件用于防止长对话压缩、换模型或换会话后失忆。每完成一个阶段，都先更新这里，再提交。

## 当前仓库

- GitHub: `OrionPace/antigravity-doc-zh`
- URL: https://github.com/OrionPace/antigravity-doc-zh
- 本地路径：`/home/admin/.openclaw/workspace/projects/antigravity-doc-zh`
- 默认分支：`main`
- GitHub Pages base：`/antigravity-doc-zh/`

## 已完成

- 仓库从 `OpenDocs-CN` 改名为 `antigravity-doc-zh`。
- 项目定位从 Gemini CLI / Codex CLI 自动翻译，转为 Google Antigravity 社区中文整理。
- 首页、README、About、ROADMAP 已完成第一轮重定位。
- 旧 Gemini CLI / Codex CLI 同步状态和翻译记忆已移动到 `archive/legacy-open-cli/`。
- `config/projects.yaml` 暂时置空：当前没有可直接复用旧 GitHub `docs/` 同步流水线的活动上游。
- 第一阶段 PR 已合并，CI 通过。

## 当前阶段

继续建设 Antigravity 中文文档基础内容：

1. 官方来源索引；
2. 中文概览；
3. Quickstart / 下载与访问说明；
4. 术语表；
5. 迁移说明；
6. 调整部署 workflow，避免空项目 sync 失败。

## 事实边界

- `https://antigravity.google/` 可访问，页面标题为 `Google Antigravity`，描述为 `Google Antigravity - Build the new way`。
- 站点前端 bundle 中包含 Antigravity 2.0、Antigravity CLI、Antigravity SDK、Antigravity IDE、pricing、release notes、blog routes 等信息。
- 由于官方网页是 SPA，当前以公开页面和前端 bundle 中暴露的文本作为第一轮资料来源；后续应补充人工浏览核验和更稳定的官方文档链接。
- 对“Gemini CLI 是否停止维护/转向 Antigravity”这类判断，除非找到官方明确表述，否则文档中只写“项目维护重心转向 Antigravity / 待核验”，不写绝对结论。

## 验证命令

当前环境没有全局 `pnpm`，使用 Corepack：

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build
```

不要运行 `corepack enable`，它会尝试写 `/usr/bin/pnpm` 并因权限失败。

## 下一步建议

- 补齐 `docs/antigravity/overview.md`、`quickstart.md`、`reference/official-sources.md`。
- 更新 `.github/workflows/sync.yml` 为单纯 build/deploy，不再定时执行旧 sync。
- 更新 `.claude/rules/*` 和旧 `implementation_plan.md`，避免后续 agent 被旧项目目标误导。
- 提交并推送到 `main`。
