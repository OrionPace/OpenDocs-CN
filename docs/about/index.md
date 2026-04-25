# 关于本站

OpenDocs CN 是一个社区维护的自动化文档翻译流水线，目标是让中文开发者更便捷地阅读热门开发者 CLI 的英文文档。

## 工作原理

1. **同步**：通过 GitHub Actions 定期拉取上游仓库 `docs/` 路径下的 Markdown 文件，固定到具体的 commit SHA。
2. **切分**：使用 [unified](https://unifiedjs.com/) / remark 把每个文件解析为 mdast，按顶层节点（段落、列表、代码块、标题等）切分为独立 _block_。
3. **翻译**：每个 block 单独发往 LLM。代码块、URL、文件路径、CLI 名称、环境变量名等不参与翻译；标题保留英文锚点 `{#slug}`。
4. **缓存**：以 `(sourceHash, glossaryHash, promptVersion)` 三元组为 key 缓存到 SQLite。下次同步若上游块未变化，**不会**调用 LLM。
5. **重组**：QA 通过后重新拼装为完整文件，写入对应路由目录，并附署名页脚。

## 翻译质量

- **默认模型**：DeepSeek `deepseek-v4-flash`。失败时自动重试一次（更严格的 prompt），仍失败则切换到 OpenRouter 兜底。
- **强制约束**：通过正则后处理验证代码栏数量、URL 数量、链接数量、标题层级数量是否与上游一致。任一项不一致直接判失败。
- **术语表**：项目级 `config/glossary.yml` 定义统一术语映射。匹配源文中的术语后，必须在译文中出现对应目标。
- **人工审阅**：可后续通过 PR 修订单条记录，并在 translation memory 中标记为 `reviewed: true`，后续机器同步不会覆盖。

## 许可证与归属

- 翻译后的 Markdown 是上游 Apache 2.0 文档的衍生作品，**继承 Apache 2.0**。每页底部有指向具体 commit 的署名页脚。
- 本仓库的基础设施代码（TypeScript、构建脚本、VitePress 配置）使用 [MIT 许可证](https://github.com/opendocs-cn/opendocs-cn/blob/main/LICENSE)。
- 上游 `LICENSE` 与 `NOTICE`（如有）镜像在 [`/licenses/`](/licenses/) 下。

## 商标声明

本站不展示上游项目方的 logo，不在任何用户可见字符串中暗示官方背书。使用上游项目名称仅为描述性引用（nominative fair use）。

## 下架请求

如上游项目方或其公司所有者要求下架、改名或重定向，将在 48 小时内配合处理。详见仓库根目录 `.claude/rules/04-compliance.md` 第 8 节。
