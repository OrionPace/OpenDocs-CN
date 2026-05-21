# 技术栈与运行方式

## 技术栈

- 文档站：VitePress
- 语言：TypeScript / Markdown
- 包管理：pnpm via Corepack
- CI：GitHub Actions
- 部署：GitHub Pages

## 当前重要配置

- VitePress config：`docs/.vitepress/config.ts`
- GitHub Pages base：`/antigravity-doc-zh/`
- 包名：`antigravity-doc-zh`
- Node：见 `.nvmrc`
- 当前没有活动的 GitHub `docs/` 上游项目：`config/projects.yaml` 中 `projects: []`

## 本地验证

当前服务器没有全局 pnpm，使用：

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build
```

不要运行 `corepack enable`，它可能尝试写 `/usr/bin/pnpm` 并失败。

## 旧同步流水线

`scripts/sync.ts`、`src/pipeline/*`、`src/translation/*` 暂时保留，但当前不作为主流程使用。未来如 Antigravity 有稳定公开文档源，可改造为官网来源同步器。
