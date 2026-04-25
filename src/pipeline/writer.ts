import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, posix, resolve } from 'node:path'
import type { ProjectConfig } from '../config/schema.js'

export interface AttributionInput {
  project: ProjectConfig
  /** Pinned upstream commit SHA at translation time. */
  upstreamSha: string
  /** Path within upstream repo (e.g. "docs/index.md"). */
  upstreamPath: string
  /** Our repo, in "owner/repo" form, used for the issue link. */
  ourRepo: string
}

/**
 * Build the per-page attribution footer mandated by 04-compliance.md §2.
 * Pinned to the exact commit so the footer cannot rot when upstream rewrites.
 */
export function buildAttributionFooter(input: AttributionInput): string {
  const { project, upstreamSha, upstreamPath, ourRepo } = input
  const shaShort = upstreamSha.slice(0, 7)
  const upstreamLink = `https://github.com/${project.owner}/${project.repo}/blob/${upstreamSha}/${upstreamPath}`
  const issueTitle = encodeURIComponent(`翻译错误：${project.id}/${upstreamPath}`)
  const issueBody = encodeURIComponent(
    [
      `项目：${project.name}`,
      `文件：${upstreamPath}`,
      `上游 commit：${upstreamSha}`,
      '',
      '请描述问题：',
      '',
    ].join('\n'),
  )
  const issueLink = `https://github.com/${ourRepo}/issues/new?title=${issueTitle}&body=${issueBody}`

  return [
    '',
    '---',
    `> 本页译自 [\`${project.owner}/${project.repo}\` @ \`${shaShort}\`](${upstreamLink})，遵循 ${project.license}。`,
    `> 社区翻译，非官方内容；以英文原文为准。发现错误？[在 GitHub 报告](${issueLink})`,
    '',
  ].join('\n')
}

export interface WriteTranslatedInput extends AttributionInput {
  /** The project's relativePath within docsPath (e.g. "guide/setup.md"). */
  relativePath: string
  /** Assembled translated Markdown body, ending in '\n'. */
  body: string
  /** Optional override of the docs root (defaults to `<cwd>/docs`). */
  docsRoot?: string
}

/**
 * Build the project-landing-page warning block mandated by compliance §5.2.
 * Injected ahead of the translated body for `<projectId>/index.md` only.
 */
function buildLandingWarning(project: ProjectConfig): string {
  return [
    '::: warning 非官方翻译',
    `本站为社区自动翻译，**不属于** ${project.name} 项目方。翻译可能存在错误或延迟；以 [英文原版文档](${project.upstreamUrl}) 为准。`,
    ':::',
    '',
  ].join('\n')
}

/**
 * Write the assembled file to `<docsRoot>/<projectId>/<relativePath>`, with
 * the attribution footer appended. For the project's `index.md`, the
 * non-official warning custom block is injected ahead of the body. Returns
 * the absolute output path.
 */
export function writeTranslatedFile(input: WriteTranslatedInput): string {
  const docsRoot = input.docsRoot ?? resolve(process.cwd(), 'docs')
  // Use posix join so output paths are consistent regardless of OS.
  const rel = posix.join(input.project.id, input.relativePath)
  const outPath = resolve(docsRoot, ...rel.split('/'))
  mkdirSync(dirname(outPath), { recursive: true })

  const footer = buildAttributionFooter(input)
  const body = input.body.endsWith('\n') ? input.body : input.body + '\n'
  const isLanding = input.relativePath === 'index.md'
  const warning = isLanding ? buildLandingWarning(input.project) + '\n' : ''
  writeFileSync(outPath, warning + body + footer, 'utf8')
  return outPath
}
