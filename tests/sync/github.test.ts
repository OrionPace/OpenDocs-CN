import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fetchFileTree, setOctokitForTesting } from '../../src/sync/github.js'
import { emptyState, readState, writeState } from '../../src/sync/state.js'

// Minimal Octokit mock covering the two calls fetchFileTree makes.
const makeMockOctokit = (tree: Array<{ path: string; type: string; sha: string }>) =>
  ({
    repos: {
      async getBranch() {
        return { data: { commit: { sha: 'deadbeef' } } }
      },
    },
    git: {
      async getTree() {
        return { data: { tree } }
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

describe('fetchFileTree', () => {
  it('returns only .md blobs under docsPath, normalised', async () => {
    setOctokitForTesting(
      makeMockOctokit([
        { path: 'README.md', type: 'blob', sha: 'a1' },
        { path: 'docs/index.md', type: 'blob', sha: 'a2' },
        { path: 'docs/guide/setup.md', type: 'blob', sha: 'a3' },
        { path: 'docs/assets/logo.png', type: 'blob', sha: 'a4' },
        { path: 'docs/guide', type: 'tree', sha: 'a5' },
      ]),
    )

    const entries = await fetchFileTree({
      id: 'x',
      name: 'X',
      owner: 'o',
      repo: 'r',
      branch: 'main',
      docsPath: 'docs/',
      route: '/x/',
      upstreamUrl: 'https://example.com',
      license: 'Apache-2.0',
    })

    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      path: 'docs/guide/setup.md',
      relativePath: 'guide/setup.md',
      sha: 'a3',
    })
    expect(entries[1]).toEqual({
      path: 'docs/index.md',
      relativePath: 'index.md',
      sha: 'a2',
    })
  })

  afterEach(() => setOctokitForTesting(null))
})

describe('state round-trip', () => {
  let tmpCwd: string
  let origCwd: string

  beforeEach(() => {
    origCwd = process.cwd()
    tmpCwd = mkdtempSync(join(tmpdir(), 'odc-state-'))
    process.chdir(tmpCwd)
  })

  afterEach(() => {
    process.chdir(origCwd)
    rmSync(tmpCwd, { recursive: true, force: true })
  })

  it('writes then reads back an identical state object', () => {
    const s = emptyState('gemini-cli')
    s.lastSyncSha = 'abc123'
    s.fileCount = 5
    s.files = [{ path: 'docs/index.md', sha: 'xxx' }]
    writeState(s)
    const got = readState('gemini-cli')
    expect(got).toEqual(s)
  })

  it('returns null for unknown project', () => {
    expect(readState('does-not-exist')).toBeNull()
  })
})
