# 合规、署名与法律姿态

适用于站点上任何用户可见内容，以及 commit/release 元数据的不可协商规则。

## 1. 许可证继承（关键）

两个上游项目都使用 Apache License 2.0：
- `google-gemini/gemini-cli` — Apache 2.0
- `openai/codex` — Apache 2.0

**我们翻译后的 `.md` 文件属于衍生作品，并继承 Apache 2.0。** 这意味着：

- 我们必须保留源文件中的版权声明。
- 我们必须在分发译文内容的地方包含 Apache 2.0 许可证文本（或其链接）。
- 我们自己的**基础设施代码**可以使用不同许可证（我们使用 MIT），但译文内容仍保持 Apache 2.0。

## 2. 每个译文页面的页脚署名

每个翻译后的 Markdown 文件都必须以机器生成的页脚结尾：

```
---
> 本页译自 [`{owner}/{repo}` @ `{sha:short}`](https://github.com/{owner}/{repo}/blob/{sha}/{upstream_path})，遵循 Apache License 2.0。
> 社区翻译，非官方内容；以英文原文为准。发现错误？[在 GitHub 报告](https://github.com/{our-repo}/issues/new?title=...&body=...)
```

- `{sha}` 是被翻译的上游 commit。
- `{our-repo}` 是本仓库；issue 链接会预填 title/body，并包含路径。

此页脚由同步流水线在 `writeTranslatedFile` 期间追加，不存入 translation memory。

## 3. 上游 NOTICE 文件

对每个上游项目，将其 `NOTICE` 文件（如果存在）复制到 `docs/public/licenses/{project-id}/NOTICE.txt`，并将其 `LICENSE` 文件复制到 `docs/public/licenses/{project-id}/LICENSE.txt`。从站点页脚链接到这两个文件。

每次同步都要检查 NOTICE — 如果上游新增或修改了它，需要镜像该变化。

## 4. 商标（不要越线）

### 我们不做什么
- **不使用 logo**：绝不在站点、社交卡片或仓库中展示 Google、Gemini、OpenAI 或 ChatGPT logo。
- **不使用看起来像官方的名称**：不要用暗示背书的方式命名仓库、域名或页面。任何用户可见字符串中禁止使用的前缀/后缀：`gemini-`、`codex-`、`openai-`、`google-`、`-official`、`-cn-official`。
- **不将商标作为标题使用**：页面标题应为 `Gemini CLI · 社区中文文档`（描述性使用），而不是 `Gemini CLI 官方文档`。

### 我们做什么
- 只将商标名称作为**描述性的指称性引用**使用（例如 “translation of the Gemini CLI documentation”）。在多数司法辖区，这属于 nominative fair use。
- 每个项目使用通用图标（简单文字标记或几何形状）；如果以后想展示真实 logo，也不要这么做。

### 仓库 / 域名规则
- 仓库名：`opendocs-cn`（工作标题，推送前确认）。
- 域名（如果之后购买）：名称不得包含 `gemini`、`codex`、`openai` 或 `google`。可接受示例：`opendocs.cn`、`docs-cn.dev`、`ghdocs.cn`。

## 5. 非官方免责声明（必须出现）

出现在：

1. **首页首屏**：
   > 社区中文翻译 · 非官方 · Unofficial community translation · Not affiliated with Google or OpenAI

2. **每个项目落地页**（例如 `/gemini-cli/index.md`）：一个 VitePress custom block：
   ```markdown
   ::: warning 非官方翻译
   本站为社区自动翻译，非 Google / Gemini CLI 官方内容。翻译可能存在错误或延迟；以 [英文原版文档](https://github.com/google-gemini/gemini-cli/tree/main/docs) 为准。
   :::
   ```

3. **Repo README**：第一段，同时提供英文和中文。

4. **站点页脚**：每个页面都显示。

## 6. 我们自己的代码许可证

- 仓库根目录 `LICENSE`：**MIT**
- 覆盖范围：`src/` 下的所有 TS 源码、scripts、VitePress config、workflow YAML、本规则文件
- 不覆盖：`docs/<project>/` 下的翻译 Markdown 文件（它们是 Apache 2.0 衍生作品）
- 在 `package.json` 中添加：`"license": "MIT"`

## 7. 隐私

- **默认不使用会传输 PII 的 analytics。** 如果以后添加 analytics，使用自托管 Plausible/Umami 或类似方案。Google Analytics 只有在明确披露且默认关闭时才可接受。
- **除 VitePress 默认行为外不使用 cookies**（VitePress 默认没有）。
- **状态文件**（`state/*.json`、`translation-memory/*.sqlite`）绝不能包含：API keys、用户 IP、用户邮箱或任何访问日志数据。
- `.gitignore` 明确列出 `.env*`（但排除 `.env.example`）。

## 8. 下架响应

如果上游项目或其公司所有者要求下架/改名/取消 fork：

1. 在 48 小时内配合。
2. 在 `/about/takedowns.md` 中记录该决定（公开、简洁）。
3. 如果他们发布官方中文版，主动提供跳转到官方上游的重定向。

我们不与这些请求对抗。与法律风险相比，本项目价值较低；我们快速交付，并根据情况调整。

## 9. 内容安全

我们**按原样**翻译上游内容。无论是否涉及政治敏感性，都不编辑、不删减、不改写。如果上游内容被中国大陆托管服务商标记：

- 不要从源 `docs/` 树中移除内容。
- 必要时可以禁用特定项目的部署，同时保留 translation memory。
- 绝不要为了通过审核而修改 translation memory 条目 — 翻译完整性比任何单一区域的 uptime 更重要。

## 10. 贡献政策（开源后）

- CLA：第 1 阶段不需要。采用简单 MIT 贡献模型。
- PR reviews：启用社区贡献后需要（第 4 阶段）。
- 人工审阅过的翻译覆盖机器输出；在 translation memory 中将这些条目标记为 `reviewed: true`，后续运行不得覆盖。
- Reviewer 必须记录在 translation memory 条目中（来自修改 PR 的 commit author）。

## 预部署检查清单（每次部署前运行）

同步流水线在写入磁盘前必须验证以下全部项目：

- [ ] 每个译文文件都有页面级署名页脚
- [ ] 站点首页包含非官方翻译 banner
- [ ] 每个项目都存在 `docs/public/licenses/{project-id}/LICENSE.txt`，并且与当前上游一致
- [ ] `docs/public/` 或任何 Vue component 中没有上游 logo
- [ ] 仓库根目录 `LICENSE`（MIT）存在且未变更
- [ ] `package.json` 的 `license` 字段为 `MIT`

任何检查失败都会中止部署。
