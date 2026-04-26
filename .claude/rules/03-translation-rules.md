# 翻译规则（v2 文件级架构）

> **架构**：v2 自 2026-04 起。每次 LLM 调用翻译**整个文件**（或对超大文件按 H2 边界切节）。源代码：`src/translation/{prompt,engine,chunker,file-qa}.ts`。
>
> 修改本文件中第 1、3 节会影响 prompt 生成 → 必须 bump `PROMPT_VERSION`（详见第 7 节）。

## 1. 硬性约束（写进 prompt，由 QA 强制）

### 不得翻译

- 围栏代码块（` ```...``` `）和行内代码（`` `...` ``）的内容
- URL 与 fragment anchors（`#installation` 必须保持英文，否则匹配上游标题锚点失效）
- 带扩展名的文件路径（`config.toml`、`src/index.ts`）
- 命令行 / flags / args / env var 名（`npm`、`gemini`、`--help`、`GEMINI_API_KEY`）
- HTML 标签 / 属性名（标签内的可见文本除外）
- 英文缩写：CLI / API / MCP / LLM / JSON / YAML / TOML / URL / HTTP / SDK

### 必须保留结构

- 标题层级（`#` `##` `###`）
- 列表标记（`-` `*` `1.`）
- 表格 `|` 与对齐行 `|---|`、blockquote `>`、水平分隔 `---`、frontmatter `---`
- 链接：`[text](url)` → 翻译 `text`，`url` 原样；reference link `[text][label]` → 翻译 `text`，保留 `label`
- HTML 标签必须**完整闭合**（v2 已知 LLM 容易遗漏闭合标签 → VitePress build 会报 "Element is missing end tag"）

### 输出纪律

- 只返回译后 Markdown，不要前言、不要解释、不要外层代码 fence
- 一个文件输入 → 一个文件输出（或一个 H2 节 → 一个 H2 节）

## 2. 锚点保留（v2 简化为 verbatim）

v1 由代码注入 `{#slug}`，v2 让 LLM 直接保留上游已存在的 `{#anchor}` 标记。

- 上游 `## Installation {#installation}` → 译文 `## 安装 {#installation}`
- 上游 `## Installation`（无显式锚点） → 译文 `## 安装`（也不要新增 — VitePress 会自己生成 `#安装`，原文 `[see](#installation)` 链接会失效，但这是上游 docs 的设计选择）
- **绝不**自己生成 / 替换 / 修改 `{#...}`

QA 通过比对源/译文 `{#...}` 数量强制（`src/translation/file-qa.ts`）。

## 3. 术语表强制

每个翻译请求附带**适用术语表条目**（source form 在源文件中出现的）。流程：

1. `matchGlossary(source, glossary)` 词边界匹配（默认大小写不敏感，除非条目 `caseSensitive: true`）
2. 注入 prompt 的 `[GLOSSARY]` 段落
3. 翻译后 `runFileQA` 验证：每个匹配条目的 `target` 必须出现在译文中
4. 缺失 → `glossary` failure → engine 用更严格的 prompt 重试一次（同 provider）
5. 仍失败 → 切下一个 provider；全部 provider 用尽 → 标记 `failed`，写英文源文占位

## 4. 重试与兜底（src/translation/engine.ts）

| 错误 | 动作 |
|---|---|
| HTTP 429 / 5xx / 网络超时 | `p-retry` 1 次（base 2s，指数退避，max 10s） |
| 输出截断（`finish_reason=length`） | 当作 QA failure，触发 stricter retry |
| 输出空 / 结构错误 / glossary 缺失 | 同 provider stricter retry 1 次 |
| stricter retry 仍失败 | 切下一个 provider，重新走完整流程 |
| 全部 provider 用尽 | 标记 `failed`，源文占位，CLI exit code 2（CI 视为软失败可继续部署） |

兜底链：**nvidia-nim → deepseek（如配置） → openrouter（如配置） → fail open**

## 5. 缓存键三元组

```
sourceHash    = SHA256(chunk.source)              // chunk = whole file 或 H2 section
glossaryHash  = SHA256(JSON.stringify(applicable))
promptVersion = PROMPT_VERSION (常量)
```

UNIQUE 索引在 `(source_hash, glossary_hash, prompt_version)`。命中 = 0 LLM 调用。

不要为了"省一次 API 调用"合并 chunk —— 每个 chunk 独立缓存。

## 6. 禁止事项

- 不要要求 LLM "improve" / "polish" / "fix" 英文源文。**只翻译。**
- 不要让 LLM 生成新术语表条目（人工编写）。
- 不要在 prompt 模板中改变缓存键三元组组成（除非 bump version）。
- 不要把 paragraph-level / block-level 概念再写回任何代码或文档（v2 已清除）。

## 7. PROMPT_VERSION 控制

- 当前：`PROMPT_VERSION = 'v2.0.0'`（`src/translation/prompt.ts`）
- 每条缓存记录都带它生成时的版本
- **修改 prompt 模板（structure / rules / glossary 渲染方式）→ 必须 bump 版本号**
- bump 会让全部缓存失效，是有意行为，不要为了"小改"而想绕过

## 8. 添加新项目

不需要改本文件 / 翻译代码。只需：

- `config/projects.yaml` 增加条目
- 可能新增 `glossary.yml` 术语
- 可能在 VitePress config 加项目侧边栏 / 落地页

## 9. v2 prompt 模板（同源真理：`src/translation/prompt.ts`）

不要把 prompt 文本拷贝到这里 —— 易过期。需要时直接读 `prompt.ts`。

模板要点（速查）：
- 包含 `[CONTEXT]`（this is first/middle/last/whole-file）、`[GLOSSARY]`、`[RULES]`（8 条非协商）、`[SOURCE]`
- 严格让 LLM "Output ONLY the translated Markdown. No preface, no commentary, no surrounding code fence."
- 第 8 条规则保证"same number of headings, same number of code blocks, same number of links"
