---
layout: home

hero:
  name: OpenDocs CN
  text: 开发者 CLI 文档 · 社区中文翻译
  tagline: 自动同步上游英文文档，使用 LLM 翻译为简体中文。社区翻译 · 非官方 · 以英文原文为准。
  actions:
    - theme: brand
      text: Gemini CLI 文档
      link: /gemini-cli/
    - theme: alt
      text: Codex CLI 文档
      link: /codex/

features:
  - title: 与上游同步
    details: 通过 GitHub Actions 定期拉取上游 docs/ 路径的最新 Markdown，每次同步都会固定 commit SHA。
  - title: 块级增量翻译
    details: 基于 SHA-256 的块级缓存命中即跳过 LLM 调用；只翻译变更的段落、列表、表格或标题。
  - title: 结构与代码逐字节保留
    details: 代码块、URL、标题锚点强制保持英文与上游一致；翻译后内部链接不会失效。
---

::: warning 非官方翻译
本站为社区自动化翻译，**不属于** Google、OpenAI 或任何上游项目方。翻译可能存在错误或延迟；以英文原文为准。发现错误请 [在 GitHub 提交 issue](https://github.com/opendocs-cn/opendocs-cn/issues)；需要权威信息请访问对应项目的官方 GitHub 仓库。
:::

## 当前收录的项目

| 项目       | 上游                                                                      | 路由                         | 上游许可证 |
| ---------- | ------------------------------------------------------------------------- | ---------------------------- | ---------- |
| Gemini CLI | [`google-gemini/gemini-cli`](https://github.com/google-gemini/gemini-cli) | [/gemini-cli/](/gemini-cli/) | Apache-2.0 |
| Codex CLI  | [`openai/codex`](https://github.com/openai/codex)                         | [/codex/](/codex/)           | Apache-2.0 |

## 翻译规则与术语表

每次 LLM 调用都遵守以下硬性约束：代码块、行内代码、URL、文件路径、CLI 名称、环境变量名一律不译；标题保留英文锚点 `{#slug}` 以维持内部链接；术语表内每条术语必须使用统一译法。

## 许可证

- **基础设施代码**：MIT，见仓库根目录 `LICENSE`。
- **翻译后的 Markdown**：作为衍生作品，继承上游 Apache 2.0；上游 LICENSE 与 NOTICE 文件镜像至 [`/licenses/`](/licenses/)。
