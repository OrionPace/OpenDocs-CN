import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { posix, resolve, sep } from 'node:path'

export interface SidebarItem {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

export interface SidebarConfig {
  [route: string]: SidebarItem[]
}

const H1_RE = /^\s*#\s+(.+?)\s*$/m

/**
 * Read a Markdown file's first H1 (or its filename without extension if no H1
 * is present) for use as a sidebar label. Strips any trailing `{#anchor}`.
 */
function readPageTitle(absPath: string): string {
  try {
    const head = readFileSync(absPath, 'utf8').slice(0, 4096)
    const m = head.match(H1_RE)
    if (m && m[1]) return m[1].replace(/\s*\{#[^}]+\}\s*$/, '').trim()
  } catch {
    // fall through
  }
  // Filename fallback (`getting-started.md` → `getting-started`).
  const base = absPath.split(sep).pop() ?? absPath
  return base.replace(/\.md$/, '')
}

function listMarkdown(dir: string): string[] {
  return readdirSync(dir)
    .filter((n) => n.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.localeCompare(b))
}

function listSubdirs(dir: string): string[] {
  return readdirSync(dir)
    .filter((n) => statSync(resolve(dir, n)).isDirectory())
    .sort((a, b) => a.localeCompare(b))
}

/**
 * Build VitePress sidebar items for one project's directory tree. Each
 * directory becomes a collapsed group whose label is the directory name; each
 * .md file becomes a leaf whose label is its first H1.
 *
 * Special-cases:
 *   - `index.md` is hoisted to a top-level link with a fixed label "概览".
 *   - `_*` files and `_*` directories are skipped (private/draft convention).
 */
function buildItems(absDir: string, route: string, relPosix = ''): SidebarItem[] {
  const items: SidebarItem[] = []

  if (relPosix === '' && existsSync(resolve(absDir, 'index.md'))) {
    items.push({ text: '概览', link: route })
  }

  for (const name of listMarkdown(absDir)) {
    if (name === 'index.md') continue
    if (name.startsWith('_')) continue
    const abs = resolve(absDir, name)
    const slug = name.replace(/\.md$/, '')
    const link = posix.join(route, relPosix, slug).replace(/\/+$/, '')
    items.push({ text: readPageTitle(abs), link })
  }

  for (const dirName of listSubdirs(absDir)) {
    if (dirName.startsWith('_')) continue
    if (dirName === 'public') continue // VitePress reserves docs/public/
    const childAbs = resolve(absDir, dirName)
    const childRel = posix.join(relPosix, dirName)
    const children = buildItems(childAbs, route, childRel)
    if (children.length > 0) {
      items.push({ text: dirName, collapsed: true, items: children })
    }
  }

  return items
}

export interface SidebarProjectInput {
  /** Project id, also the directory name under docs/ (e.g. "gemini-cli"). */
  id: string
  /** Public route (e.g. "/gemini-cli/"). */
  route: string
}

/**
 * Build VitePress's `themeConfig.sidebar` map by scanning the on-disk docs
 * tree. Run after the translation pipeline writes files, before
 * `vitepress build`.
 */
export function buildSidebar(
  projects: readonly SidebarProjectInput[],
  docsRoot: string,
): SidebarConfig {
  const sidebar: SidebarConfig = {}
  for (const p of projects) {
    const projDir = resolve(docsRoot, p.id)
    if (!existsSync(projDir)) {
      sidebar[p.route] = []
      continue
    }
    sidebar[p.route] = buildItems(projDir, p.route)
  }
  return sidebar
}
