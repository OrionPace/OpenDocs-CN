# 翻译规则（每次 LLM 调用都必须遵守）

这些规则是强制性的。它们会进入每个翻译 prompt，并由后处理 QA 强制检查。任何违反硬性约束的翻译都将被丢弃并重试。

## 1. LLM 输出的硬性约束

### 1.1 绝不翻译
- 围栏代码块内的内容（ ```...``` ）
- 行内代码内的内容（ `...` ）
- URL，包括 scheme 和 path
- URL fragment anchors（例如 `#installation`）— **必须保持英文**，以匹配上游标题锚点
- 带扩展名的文件路径（`config.toml`、`src/index.ts`、`docs/README.md`）
- 命令行调用（flags、arguments、env var names）
- 环境变量名（`GEMINI_API_KEY`、`PATH`）
- 包名、二进制名和 CLI 名称（`npm`、`pnpm`、`node`、`gemini`、`codex`、`docker`）
- HTML 标签及其属性名/属性值（可见文本内容除外）

### 1.2 精确保留结构
- 标题层级（`#`、`##`、`###`）
- 列表标记（`-`、`*`、`1.`）
- 表格竖线 `|` 和对齐行 `|---|`
- Blockquote `>` 标记
- 水平分隔线 `---`
- 文件顶部的 Frontmatter 分隔符 `---`
- 链接语法：在 `[text](url)` 中，翻译 `text`，绝不改动 `url`
- Reference-style link labels：`[text][label]` — 翻译 `text`，保留 `label`

### 1.3 输出纪律
- 只返回翻译后的 Markdown。
- 不要前言（例如 “Here is the translation: ...”），不要解释，不要给整个结果包一层代码块。
- 一个输入块 → 一个输出块。不要拆分或合并块。

## 2. 锚点保留规则（关键 — 不要跳过）

上游 `## Installation` 会生成锚点 `#installation`。如果我们翻译成 `## 安装`，VitePress 会生成 `#安装`，原文件中的每个内部链接 `[see](#installation)` 都会**静默失效**。

**解决方案**：AST splitter 为每个译后标题添加显式锚点，指向原始英文 slug：

```markdown
## 安装 {#installation}
```

Splitter 规则：
- 对 mdast 中每个 `heading` node，根据原始英文文本计算 slug（使用默认设置的 `github-slugger`，匹配 VitePress 默认行为）。
- 在发送给 LLM 前，将 slug 作为 `anchor_hint` 附加到标题；返回后，再把它作为 `{#slug}` 重新附加到译后标题。
- 如果上游标题已经有自定义 `{#custom-slug}` 标记，原样保留，不要生成新锚点。
- 如果 VitePress config 覆盖了 slugger，这里也要匹配该覆盖。

QA 层会验证：每个译后标题要么带有 `{#...}`，要么在规则中被标记为有意无锚点的情况。

## 3. 术语表强制执行

每个翻译请求都携带一组**适用的术语表条目**，也就是 source form 出现在源块中的术语。

匹配函数：
1. 对每个术语表条目，测试 `source` 是否出现在源块中（词边界匹配；默认大小写不敏感，除非条目另有说明）。
2. 将匹配条目注入 prompt 的 `[GLOSSARY]` section。
3. 翻译后，验证每个匹配条目的 `target` 术语是否出现在译文中。
4. 如果任何匹配术语缺失，标记为 `glossary_violation`，并用更严格的 prompt 重试一次，重试 prompt 顶部列出违规条目。
5. 如果重试仍失败，记录日志并保留可用的最佳译文（标记为需要人工审阅）。

## 4. 上下文注入（必需，不可选）

没有上下文的块级翻译会导致语气不一致，以及指代错误（如 “the above”、“this section”）。每次块级调用都必须包含：

| 字段 | 目的 |
|---|---|
| `document_title` | 当前文件的 H1 |
| `section_title` | 最近的 H2/H3 祖先标题文本 |
| `prev_block_source` | 前一个兄弟块的源文，逐字英文 |
| `next_block_source` | 后一个兄弟块的源文，逐字英文 |
| `project_id` | 用于每个项目的 prompt 风格调整 |

上下文块在 prompt 中标记为 **READ-ONLY, DO NOT TRANSLATE**。Prompt 模板（`04-translation-rules.md §7`）用明确分隔符包裹这些内容。

**Token budget**：上下文会增加约 200-500 tokens。可以接受。如果目标块本身超过 `MAX_BLOCK_TOKENS`（默认 1500），splitter 本应将其切得更小 — 这是 bug，不是丢弃上下文的理由。

## 5. 重试与兜底策略

### 5.1 错误分类

| 错误 | 动作 |
|---|---|
| HTTP 429（rate limit） | 指数退避，base 2 s，最多 5 次 |
| HTTP 5xx | 指数退避，base 1 s，最多 3 次，然后切换兜底 provider |
| Network/timeout | 每次 5s timeout，尝试 3 次，然后切换兜底 provider |
| 输出为空 | 使用相同 prompt 重试一次 |
| 输出无法通过 Markdown parse | 用更严格的 “output only Markdown” prompt 重试一次 |
| 输出未通过术语表检查 | 重试一次，并重新强调违规术语 |
| 输出缺少标题锚点 | 重试一次，并重新强调锚点要求 |

### 5.2 兜底链
1. DeepSeek `deepseek-v4-flash`
2. DeepSeek `deepseek-v4-pro`（结构性失败重试时）
3. OpenRouter（配置的模型）— 仅当设置了 `OPENROUTER_API_KEY`
4. 放弃：在 translation memory 中将块标记为 `status: failed`；输出英文源文作为占位；用 block ID 记录日志供人工审阅

每个失败块都会记录到 `state/{project-id}.json#failed_blocks`，包含时间戳、原因和块源 hash，以便下次运行可以重试。

## 6. 禁止事项

- 不要要求 LLM “improve”、“polish” 或 “fix” 英文源文。只做翻译。
- 不要请求会改变 Markdown 块结构的翻译。一个块输入，一个块输出。
- 不要在单次调用中发送超过 `MAX_BLOCK_TOKENS` 的文件 — 必须先切分。
- 不要为了“节省一次 API 调用”而拼接多个块。每个块都是带有自己 hash 的独立缓存单元。
- 不要让 LLM 生成新的术语表条目。术语表由人工编写。
- 如果 `(source_hash, glossary_hash, prompt_version)` 三元组已存在于 translation memory，不要重新翻译该块。缓存命中是免费的；LLM 调用耗钱耗时。

## 7. 标准翻译 prompt

每次块级翻译调用都使用此模板，并在请求时填充变量。将其存储为带版本的常量；更改 prompt 会使缓存失效（因为 `prompt_version` 是缓存键的一部分）。

```
You are a technical documentation translator. Translate the specified Markdown block from English to Simplified Chinese.

[DOCUMENT TITLE]
{document_title}
[END DOCUMENT TITLE]

[SECTION]
{section_title}
[END SECTION]

[PREVIOUS BLOCK — CONTEXT ONLY, DO NOT TRANSLATE OR OUTPUT]
{prev_block_source}
[END PREVIOUS BLOCK]

[TRANSLATE THIS BLOCK]
{block_source}
[END BLOCK]

[NEXT BLOCK — CONTEXT ONLY, DO NOT TRANSLATE OR OUTPUT]
{next_block_source}
[END NEXT BLOCK]

[GLOSSARY — apply to this block]
{glossary_entries_yaml}
[END GLOSSARY]

[RULES]
1. Never translate content inside code fences or inline code.
2. Never translate URLs, URL anchors, file paths, CLI names, flags, or env var names.
3. Preserve Markdown structure: headings, lists, tables, quotes, frontmatter delimiters.
4. In links `[text](url)`: translate the visible text; the URL stays exact.
5. For every heading, keep the anchor-hint I gave you: output `## 译文 {#original-slug}`.
6. Keep English acronyms (CLI, API, MCP, LLM, JSON, YAML) untranslated.
7. Apply glossary terms exactly as given. If the source contains a glossary source term, the translation must contain its target term.
8. Output ONLY the translated Markdown block. No preface. No backticks around the whole output. No explanation.

Translate now.
```

`glossary_entries_yaml` 的渲染方式如下：
```yaml
- agent → 智能体 (note: fixed term in agent tooling; do not use 代理)
- sandbox → 沙箱
- MCP → MCP (keep as acronym; first occurrence may add "模型上下文协议")
```

## 8. 禁止翻译内容保护（regex guards，最后一道防线）

LLM 返回后，运行这些正则检查。若与源文相比数量不一致，则重试。

- 围栏代码块数量：`/```[\s\S]*?```/gm`
- 行内代码数量：`/`[^`\n]+`/g`
- URL 数量：`/https?:\/\/[^\s)]+/g`
- 各级标题数量
- 链接数量：`/\[([^\]]+)\]\(([^)]+)\)/g`

如果数量匹配，但代码块内容与源文逐字节不同，**从源文恢复** — 这不是重试，而是确定性修复。

## 9. Prompt 版本控制

- `PROMPT_VERSION = "v1.0.0"` 存在于代码中。
- 每条缓存记录都会记录生成它的 `prompt_version`。
- 提升版本会使所有块的缓存失效 — 这是有意行为，必须是清醒决策，而不是编辑模板造成的意外副作用。

## 10. 添加新项目时会改变什么

添加新的上游项目**不需要**修改本文件。需要的是：
- 在 `config/projects.yaml` 中增加新条目
- 可能需要新增一个 `sidebar.override.yml` section
- 可能需要在 `glossary.yml` 中新增术语

以上都是配置，不是代码。翻译规则与项目无关。
