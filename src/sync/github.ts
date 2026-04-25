import { Octokit } from '@octokit/rest'
import type { ProjectConfig } from '../config/schema.js'

export interface FileEntry {
  /** Path relative to repo root (e.g. "docs/index.md"). */
  path: string
  /** Path relative to the project's docsPath (e.g. "index.md"). */
  relativePath: string
  /** Git blob SHA — used to detect whether this file changed. */
  sha: string
}

export interface UpstreamLicenses {
  license: string
  notice?: string
}

let _octokit: Octokit | null = null

function octokit(): Octokit {
  if (_octokit) return _octokit
  const token = process.env.GITHUB_TOKEN
  _octokit = new Octokit(token ? { auth: token } : {})
  return _octokit
}

/** For tests: inject a pre-built Octokit mock. */
export function setOctokitForTesting(o: Octokit | null): void {
  _octokit = o
}

/**
 * Resolve the commit SHA the branch currently points at. Used as the pinned
 * commit for attribution footers.
 */
export async function fetchBranchSha(project: ProjectConfig): Promise<string> {
  const { data } = await octokit().repos.getBranch({
    owner: project.owner,
    repo: project.repo,
    branch: project.branch,
  })
  return data.commit.sha
}

/**
 * List every Markdown file under `project.docsPath` recursively, with its
 * current git blob SHA. Uses the git tree API (one request) instead of the
 * contents API (one request per directory).
 */
export async function fetchFileTree(project: ProjectConfig): Promise<FileEntry[]> {
  const branchSha = await fetchBranchSha(project)
  const { data: treeResp } = await octokit().git.getTree({
    owner: project.owner,
    repo: project.repo,
    tree_sha: branchSha,
    recursive: 'true',
  })

  const docsPrefix = project.docsPath.endsWith('/') ? project.docsPath : project.docsPath + '/'

  const entries: FileEntry[] = []
  for (const item of treeResp.tree) {
    if (item.type !== 'blob') continue
    if (!item.path || !item.sha) continue
    if (!item.path.startsWith(docsPrefix)) continue
    if (!item.path.toLowerCase().endsWith('.md')) continue
    entries.push({
      path: item.path,
      relativePath: item.path.slice(docsPrefix.length),
      sha: item.sha,
    })
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

/** Fetch raw content of one file at the current branch HEAD. */
export async function fetchFileContent(project: ProjectConfig, path: string): Promise<string> {
  const { data } = await octokit().repos.getContent({
    owner: project.owner,
    repo: project.repo,
    path,
    ref: project.branch,
    mediaType: { format: 'raw' },
  })
  if (typeof data === 'string') return data
  // Some Octokit response shapes return an object even with format:raw when
  // content is a directory listing — callers should only pass blob paths.
  throw new Error(`Unexpected non-string response for ${path}`)
}

/**
 * Fetch LICENSE (+ NOTICE if present) from the repo root, decoded to UTF-8
 * string. Used to mirror upstream license text to docs/public/licenses/.
 */
export async function fetchLicenseFiles(project: ProjectConfig): Promise<UpstreamLicenses> {
  const licenseRaw = await fetchFileRaw(project, 'LICENSE').catch(() =>
    fetchFileRaw(project, 'LICENSE.txt'),
  )
  if (!licenseRaw) {
    throw new Error(`No LICENSE file found in ${project.owner}/${project.repo}@${project.branch}`)
  }
  const notice = await fetchFileRaw(project, 'NOTICE').catch(() => undefined)
  return { license: licenseRaw, notice }
}

async function fetchFileRaw(project: ProjectConfig, path: string): Promise<string> {
  const { data } = await octokit().repos.getContent({
    owner: project.owner,
    repo: project.repo,
    path,
    ref: project.branch,
    mediaType: { format: 'raw' },
  })
  if (typeof data === 'string') return data
  throw new Error(`Non-string content for ${path}`)
}
