# 开发环境

## 本地机器

- **OS**：Windows 11
- **CPU**：AMD Ryzen 7 8845H
- **GPU**：NVIDIA RTX 4060（8 GB VRAM）— **本项目不使用**
- **Shell**：默认使用 PowerShell 7（pwsh）；也可使用 Git Bash
- **Node**：通过 `nvm-windows` 或官方安装程序安装，并由 `.nvmrc` 固定版本

## 跨平台要求

本项目在本地 Windows 和 CI Ubuntu 上运行。每个脚本都必须在两者上可用。

**不要**：
- 在 `package.json` scripts 中用 `&&` 串联命令（PowerShell 5.1 不支持；7 支持，但 CI 有时会使用较旧 shell）。使用 `pnpm-run-many` 或拆成多个脚本。
- 在任何提交的脚本中使用仅 POSIX 可用的工具（`find`、`xargs`、`sed -i`、`rm -rf`）。改用 Node.js 脚本。
- 在路径中硬编码 `/` 或 `\`。始终使用 `path.join()`、`path.posix.join()` 或 `node:path` helper。
- 在 scripts 中使用 shell 展开的 globs。改为在 Node 中使用 glob 库（`fast-glob`、`globby`）。

**要做**：
- 所有自动化都写成 `scripts/` 下的 `.ts` 文件，并用 `tsx` 运行。
- 提交 `.gitattributes`，强制 `* text=auto eol=lf`，避免 Windows checkout 破坏 VitePress 构建。
- 使用 `dotenv` 加载 `.env.local`；不要依赖 shell `export`。

## 路径与文件系统注意事项

- Windows MAX_PATH 默认是 260 个字符。不要创建过深的输出路径。我们的 `state/`、`translation-memory/` 和 `docs/<project>/` 路径会保持在此限制内。
- 不使用符号链接。Windows 上 symlink 需要管理员权限；跨平台代码不得创建或跟随 symlink。
- 文件监听：VitePress dev 模式的 watcher 在 Windows 11 上工作正常；不需要 polling 配置。

## Git

- 用户应该确保 `git` 在 PATH 上。
- 推荐安装 `gh` CLI，但代码不依赖它。
- Commit message 应使用英文（conventional commits 风格），不要用中文，这样更兼容工具链。

## 本地密钥

在仓库根目录创建 `.env.local`（已 gitignored）：

```dotenv
DEEPSEEK_API_KEY=sk-xxx
OPENROUTER_API_KEY=sk-or-xxx        # 可选
GITHUB_TOKEN=ghp_xxx                 # 可选，用于提高上游 API 速率限制
```

绝不要提交这些内容。`.gitignore` 必须包含 `.env*`，但排除 `.env.example`。

## CI 密钥（GitHub Actions）

变量名相同，在 repo Settings → Secrets and variables → Actions 中配置：
- `DEEPSEEK_API_KEY`（必需）
- `OPENROUTER_API_KEY`（可选）
- 内置 `GITHUB_TOKEN` 已足够；普通 workflow 不需要单独 PAT。只有需要跨仓库写入时才创建 PAT。

## GPU / 本地推理

虽然这台机器有 RTX 4060：**不要提出任何本地 LLM 兜底路径**（不要 Ollama、不要 llama.cpp、不要本地 Phi/Qwen）。8 GB VRAM 无法容纳能以可接受质量翻译技术文档的模型，批处理经济性也不成立。翻译始终基于 API。

如果用户以后要求这么做，那是一个独立规格。

## 时区

- Workflow 中所有 cron 表达式都使用 **UTC**。YAML 注释应包含对应的北京时间。
- 我们代码产生的日志时间戳使用 UTC 的 ISO 8601（不使用本地时间）。
