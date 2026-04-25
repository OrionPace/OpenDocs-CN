# Project Overview — OpenDocs-CN

> **Read this first.** Every decision in other rule files and in `implementation_plan.md` assumes this context.

## What we're building

An automated pipeline that:

1. Syncs English documentation from GitHub open-source projects (their `docs/` paths),
2. Translates it to Simplified Chinese using LLM APIs with block-level incremental caching,
3. Publishes a multi-project static documentation site.

The system is a **documentation-sync-and-translate** tool — **not** a general-purpose translator, not a proxy, not a reading-mode extension.

## Why

Popular developer CLIs (Gemini CLI, Codex, and more later) update their English docs frequently. Existing Chinese translations lag weeks or never sync. Users need an always-current Chinese reference they can bookmark.

## Phase 1 scope (MVP) — this is what we ship first

Two projects, nothing more:

| Project | Upstream | Route |
|---|---|---|
| Gemini CLI | `google-gemini/gemini-cli` @ `main`, path `docs/` | `/gemini-cli/` |
| Codex CLI | `openai/codex` @ `main`, path `docs/` | `/codex/` |

Homepage shows two cards (icon + title + "中文文档" label). Clicking a card opens that project's docs with a left sidebar.

## Non-goals for MVP (do not implement)

- ❌ Side-by-side bilingual reading view (link to upstream English instead)
- ❌ PR-review-based community contribution flow (direct commit for MVP)
- ❌ Non-Markdown content translation (no image text OCR, no MDX components, no Jupyter notebooks)
- ❌ Multi-version docs (only track upstream default branch)
- ❌ Local LLM inference (the 4060 is not used)
- ❌ Search infrastructure beyond VitePress's built-in local search
- ❌ i18n for site chrome (the UI is Chinese-first; no English UI toggle)
- ❌ Custom theme design (use VitePress default with minor color tweak)

## Success criteria for Phase 1

Concrete acceptance tests. Implementation is not done until all pass:

1. Run `pnpm run sync` on a fresh checkout with both API keys set → both projects are fully translated and VitePress builds without error.
2. Re-run `pnpm run sync` with no upstream changes → **zero** LLM calls, only state timestamps update.
3. Modify one paragraph in one upstream `.md` locally (simulated change) → only the changed block triggers an LLM call; other blocks hit cache.
4. Every code fence, inline code span, URL, and heading anchor from the upstream file is byte-identical (minus the heading text itself) in the translated file.
5. Every glossary term mapping is honored — QA reports no `glossary_violation`.
6. Site deploys to GitHub Pages and Cloudflare Pages from the same build artifact.
7. Each translated page has a footer linking to the upstream commit-pinned source.
8. Homepage clearly states "社区中文翻译 · 非官方" above the fold.

## Status & ownership

- Current status: **planning complete, implementation starting**.
- Coding agent: Antigravity (spec-driven: `implementation_plan.md` → `task.md` → review).
- Human reviewer: project owner (you).
- Phase-1 target: fully working end-to-end pipeline, not polished.

## Pointers to other rules

- Tech stack and versions: `01-tech-stack.md`
- Windows dev environment: `02-environment.md`
- Binding translation rules for every LLM call: `03-translation-rules.md`
- License, trademark, privacy: `04-compliance.md`

If any rule conflicts with this overview, this overview wins. Flag it and ask.
