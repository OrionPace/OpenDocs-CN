import GithubSlugger from 'github-slugger'

/**
 * Produce a fresh slugger bound to one file. Re-used across all headings in the
 * same file so duplicate headings get the `-1`, `-2` suffix that VitePress
 * (and GitHub) would also apply.
 */
export function createSlugger(): GithubSlugger {
  return new GithubSlugger()
}

/** Slug a single string as if it were the only heading in a file. */
export function slugify(text: string): string {
  return new GithubSlugger().slug(text)
}
