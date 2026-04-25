# Compliance, Attribution, and Legal Posture

Non-negotiable rules for anything user-visible on the site or in commit/release metadata.

## 1. License inheritance (critical)

Both upstream projects are Apache License 2.0:
- `google-gemini/gemini-cli` — Apache 2.0
- `openai/codex` — Apache 2.0

**Our translated `.md` files are derivative works and inherit Apache 2.0.** This means:

- We must preserve copyright notices from the source.
- We must include the Apache 2.0 license text (or a link to it) where translated content is distributed.
- We can license our own **infrastructure code** differently (we use MIT), but translated content stays Apache 2.0.

## 2. Footer attribution on every translated page

Every translated Markdown file must end with a machine-generated footer:

```
---
> 本页译自 [`{owner}/{repo}` @ `{sha:short}`](https://github.com/{owner}/{repo}/blob/{sha}/{upstream_path})，遵循 Apache License 2.0。
> 社区翻译，非官方内容；以英文原文为准。发现错误？[在 GitHub 报告](https://github.com/{our-repo}/issues/new?title=...&body=...)
```

- `{sha}` is the upstream commit that was translated.
- `{our-repo}` is this repo; the issue link pre-fills title/body with the path.

This footer is appended by the sync pipeline during `writeTranslatedFile`, not stored in translation memory.

## 3. Upstream NOTICE files

For every upstream project, copy its `NOTICE` file (if it exists) to `docs/public/licenses/{project-id}/NOTICE.txt` and its `LICENSE` file to `docs/public/licenses/{project-id}/LICENSE.txt`. Link both from the site footer.

Check for NOTICE on each sync run — if upstream adds or changes it, mirror the change.

## 4. Trademarks (do not cross this line)

### What we don't do
- **No logos**: never display Google, Gemini, OpenAI, or ChatGPT logos anywhere on the site, social cards, or repo.
- **No official-looking names**: do not name the repo, domain, or pages in a way that implies endorsement. Banned prefixes on any user-visible string: `gemini-`, `codex-`, `openai-`, `google-`, `-official`, `-cn-official`.
- **No trademark use as title**: page titles should be `Gemini CLI · 社区中文文档` (descriptive use), not `Gemini CLI 官方文档`.

### What we do
- Use trademarked names only as **descriptive nominative references** (e.g., "translation of the Gemini CLI documentation"). This is allowed under nominative fair use in most jurisdictions.
- Generic icon per project (a simple typographic mark or a geometric shape); if we ever want to show the real logo, we don't.

### Repo / domain name rules
- Repo name: `opendocs-cn` (working title, confirm before pushing).
- Domain (if purchased later): any name that does NOT contain `gemini`, `codex`, `openai`, or `google`. Acceptable: `opendocs.cn`, `docs-cn.dev`, `ghdocs.cn`.

## 5. Unofficial disclaimer (must appear)

Appears on:

1. **Homepage, above the fold**:
   > 社区中文翻译 · 非官方 · Unofficial community translation · Not affiliated with Google or OpenAI

2. **Every project landing page** (e.g. `/gemini-cli/index.md`): a VitePress custom block:
   ```markdown
   ::: warning 非官方翻译
   本站为社区自动翻译，非 Google / Gemini CLI 官方内容。翻译可能存在错误或延迟；以 [英文原版文档](https://github.com/google-gemini/gemini-cli/tree/main/docs) 为准。
   :::
   ```

3. **Repo README**: first paragraph, in both English and Chinese.

4. **Site footer**: on every page.

## 6. Our own code license

- `LICENSE` at repo root: **MIT**
- Covers: all TS source in `src/`, scripts, VitePress config, workflow YAMLs, this rules file
- Does NOT cover: translated Markdown files under `docs/<project>/` (those are Apache 2.0 derivatives)
- Add to `package.json`: `"license": "MIT"`

## 7. Privacy

- **No analytics that transmit PII by default.** If we add analytics later, use self-hosted Plausible/Umami or similar. Google Analytics is acceptable only if clearly disclosed and off by default.
- **No cookies** beyond VitePress defaults (none).
- **State files** (`state/*.json`, `translation-memory/*.sqlite`) must never contain: API keys, user IPs, user emails, or any access log data.
- The `.gitignore` explicitly lists `.env*` (except `.env.example`).

## 8. Takedown response

If the upstream project or its corporate owner requests takedown/rename/un-fork:

1. Comply within 48 hours.
2. Document the decision in `/about/takedowns.md` (publicly, concisely).
3. Offer to host a redirect to the official upstream if they publish an official Chinese version.

We do NOT fight these requests. The project's value is low relative to legal risk; we ship fast and adapt.

## 9. Content safety

We translate upstream content **as-is**. We do not edit, redact, or rewrite for any reason including political sensitivity. If upstream content is flagged by mainland hosting providers:

- Do not remove content from the source `docs/` tree.
- If necessary, disable a specific project's deployment while keeping translation memory intact.
- Never alter translation memory entries to pass review — integrity of translations matters more than uptime in any single region.

## 10. Contribution policy (when we open-source)

- CLA: not required for Phase 1. Simple MIT contribution model.
- PR reviews: required once we enable community contributions (Phase 4).
- Human-reviewed translations override machine output; mark these entries `reviewed: true` in translation memory so subsequent runs do not overwrite them.
- Reviewer must be named in the translation memory entry (commit author from the modifying PR).

## Pre-flight checklist (run before every deploy)

The sync pipeline must verify all of these before writing to disk:

- [ ] Every translated file has a per-page attribution footer
- [ ] Site homepage contains the unofficial-translation banner
- [ ] `docs/public/licenses/{project-id}/LICENSE.txt` exists for each project and matches current upstream
- [ ] No upstream logos in `docs/public/` or any Vue component
- [ ] Repo root `LICENSE` (MIT) is present and unchanged
- [ ] `package.json` `license` field is `MIT`

Any failed check aborts the deploy.
