# 合规、署名、预部署清单

适用于站点上任何用户可见内容、commit / release 元数据。

## 1. 许可证继承

两个上游均为 **Apache 2.0**（`google-gemini/gemini-cli`、`openai/codex`）。译后 `.md` 是衍生作品 → 也是 Apache 2.0：

- 保留源文件的版权声明
- 分发译文处必须包含 Apache 2.0 文本或链接
- **基础设施代码**（`src/`、scripts、workflow、本规则）**MIT**（仓库根 `LICENSE`、`package.json` 的 `"license": "MIT"`）

## 2. 每页必须的页脚（由 `src/pipeline/writer.ts` 注入）

```markdown
---
> 本页译自 [`{owner}/{repo}` @ `{sha:short}`](https://github.com/{owner}/{repo}/blob/{sha}/{upstream_path})，遵循 Apache License 2.0。
> 社区翻译，非官方内容；以英文原文为准。发现错误？[在 GitHub 报告](https://github.com/{our-repo}/issues/new?title=...&body=...)
```

页脚不写入 translation memory（每次写文件时拼接）。

## 3. 上游 LICENSE / NOTICE 镜像

每次 sync 后 `scripts/fetch-licenses.ts` 拉：
- `docs/public/licenses/{project-id}/LICENSE.txt`
- `docs/public/licenses/{project-id}/NOTICE.txt`（如存在）

站点全局 footer 链接到这两个文件。

## 4. 商标禁忌

**不做**：

- 展示 Google / Gemini / OpenAI / ChatGPT logo（任何位置）
- 用看似官方的命名：禁止前缀 / 后缀 `gemini-` `codex-` `openai-` `google-` `-official` `-cn-official`
- 标题写"官方"：用"Gemini CLI · 社区中文文档"，不写"Gemini CLI 官方文档"

**做**：

- 名称仅作描述性指称使用（"translation of the Gemini CLI documentation"）
- 通用图标 / 文字标记，不放真实 logo

仓库名 `OpenDocs-CN`。如未来注册域名，名称中**不得**含 `gemini` `codex` `openai` `google`。

## 5. "非官方"声明（必须出现的位置）

1. **首页首屏**：`docs/index.md` 包含 "社区中文翻译 · 非官方"（`predeploy:check` 强制检查这一字符串，**注意词序**）
2. **每个项目落地页**（`docs/{project}/index.md`）：VitePress `::: warning` 块（由 writer 注入）
3. **Repo README**：第一段中英对照
4. **站点全局 footer**：每页显示

## 6. 隐私

- 默认无 analytics。若加，使用自托管 Plausible / Umami；Google Analytics 仅在显式披露 + 默认关闭时可接受。
- 不主动设 cookies。
- `state/*.json`、`translation-memory/*.sqlite` **不得**包含 API keys / 用户 IP / email。
- `.gitignore` 含 `.env*`（保留 `.env.example`）。

## 7. 下架响应

上游或其所有者要求下架 / 改名 / 取消 fork：48 小时内配合，记录到 `/about/takedowns.md`，必要时重定向到官方上游。**不抗辩。**

## 8. 内容安全

按原样翻译，不审查 / 删减 / 改写。被中国大陆托管商标记 → 可禁用单项目部署但保留 translation memory，**绝不**修改 memory 条目。

## 9. 预部署检查清单（`scripts/predeploy-check.ts` 强制）

deploy 前每次跑，任一失败 → 中止：

- [ ] 每个译文文件都有页面级署名页脚
- [ ] 站点首页含"社区中文翻译 · 非官方"banner
- [ ] `docs/public/licenses/{project-id}/LICENSE.txt` 存在且与上游一致
- [ ] `docs/public/` 与组件中无上游 logo
- [ ] 仓库根 `LICENSE`（MIT）存在
- [ ] `package.json` 的 `license: MIT`
