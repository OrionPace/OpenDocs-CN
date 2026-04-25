# Development Environment

## Local machine

- **OS**: Windows 11
- **CPU**: AMD Ryzen 7 8845H
- **GPU**: NVIDIA RTX 4060 (8 GB VRAM) — **not used by this project**
- **Shell**: PowerShell 7 (pwsh) is the default; Git Bash is available
- **Node**: installed via `nvm-windows` or the official installer, pinned by `.nvmrc`

## Cross-platform requirements

This project runs locally on Windows and in CI on Ubuntu. Every script must work on both.

**Do not**:
- Chain commands with `&&` in `package.json` scripts (PowerShell 5.1 didn't support it; 7 does, but CI sometimes uses older shells). Use `pnpm-run-many` or separate scripts.
- Use POSIX-only utilities (`find`, `xargs`, `sed -i`, `rm -rf`) in any committed script. Use Node.js scripts instead.
- Hardcode `/` or `\` in paths. Always use `path.join()`, `path.posix.join()`, or `node:path` helpers.
- Use shell-expanded globs in scripts. Use a glob library (`fast-glob`, `globby`) in Node.

**Do**:
- Author all automation as `.ts` files in `scripts/` and run them with `tsx`.
- Commit `.gitattributes` enforcing `* text=auto eol=lf` so cloned checkouts don't break VitePress builds on Windows.
- Use `dotenv` to load `.env.local`; don't rely on shell `export`.

## Paths & file system quirks

- Windows MAX_PATH is 260 chars by default. Don't create deeply nested output paths. Our `state/`, `translation-memory/`, and `docs/<project>/` paths stay under this.
- No symlinks. Symlinks on Windows require admin; cross-platform code must not create or follow them.
- File watchers: VitePress's dev mode watcher works fine on Windows 11; no polling config needed.

## Git

- User should have `git` on PATH.
- `gh` CLI recommended but not required by the code.
- Commit messages should be in English (conventional commits style), not Chinese — keeps it tool-compatible.

## Local secrets

Create `.env.local` at repo root (gitignored):

```dotenv
DEEPSEEK_API_KEY=sk-xxx
OPENROUTER_API_KEY=sk-or-xxx        # optional
GITHUB_TOKEN=ghp_xxx                 # optional, for higher upstream API rate
```

Never commit these. The `.gitignore` must include `.env*` except `.env.example`.

## CI secrets (GitHub Actions)

Same variable names, configured in repo Settings → Secrets and variables → Actions:
- `DEEPSEEK_API_KEY` (required)
- `OPENROUTER_API_KEY` (optional)
- The built-in `GITHUB_TOKEN` is sufficient; no separate PAT needed for normal workflows. Only create a PAT if we need cross-repo writes.

## GPU / local inference

Even though the machine has an RTX 4060: **do not propose any local-LLM fallback path** (no Ollama, no llama.cpp, no local Phi/Qwen). 8 GB VRAM can't hold models that translate technical docs at acceptable quality, and the batch economics don't work out. Translation is always API-based.

If the user later requests this, it's a separate spec.

## Timezone

- All cron expressions in workflows are **UTC**. Comments in YAML should include the Beijing-time equivalent.
- Log timestamps produced by our code use ISO 8601 in UTC (no local time).
