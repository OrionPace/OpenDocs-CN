import pLimit from 'p-limit'
import type { ProjectConfig } from '../config/schema.js'
import { assembleFile, type AssembledBlock } from '../markdown/assembler.js'
import { splitFile } from '../markdown/splitter.js'
import { fetchBranchSha, fetchFileContent, fetchFileTree, type FileEntry } from '../sync/github.js'
import { emptyState, readState, writeState } from '../sync/state.js'
import { translateBlock } from '../translation/engine.js'
import { matchGlossary } from '../translation/glossary.js'
import type { TranslationMemory } from '../translation/memory.js'
import type { TranslationProvider } from '../translation/providers/interface.js'
import type {
  Block,
  FailedBlock,
  GlossaryEntry,
  ProjectState,
  TrackedFile,
} from '../translation/types.js'
import { writeTranslatedFile } from './writer.js'

export interface RunOptions {
  /** Force re-translation of every file regardless of cache. */
  full?: boolean
  /** Concurrency limit for blocks within a single file. */
  blocksPerFile?: number
  /** Concurrency limit for files processed in parallel. */
  filesInParallel?: number
  /** Override docs output root (default `<cwd>/docs`). */
  docsRoot?: string
  /** Owner/repo of THIS project, used in attribution footer. */
  ourRepo: string
}

export interface RunSummary {
  projectId: string
  filesScanned: number
  filesChanged: number
  filesTranslated: number
  blocksTranslated: number
  cacheHits: number
  failures: number
  upstreamSha: string
}

interface FileResult {
  entry: FileEntry
  tracked: TrackedFile
  cacheHits: number
  blocksTranslated: number
  failures: number
  failedBlocks: FailedBlock[]
}

/**
 * Sync one project end-to-end: fetch tree → diff against state → translate
 * changed files → write to disk → update state. Idempotent: if no upstream
 * file changed and `--full` isn't set, this performs zero LLM calls.
 */
export async function syncProject(
  project: ProjectConfig,
  providers: readonly TranslationProvider[],
  memory: TranslationMemory,
  glossary: readonly GlossaryEntry[],
  options: RunOptions,
): Promise<RunSummary> {
  const upstreamSha = await fetchBranchSha(project)
  const tree = await fetchFileTree(project)
  const prev = readState(project.id) ?? emptyState(project.id)

  const prevByPath = new Map(prev.files.map((f) => [f.path, f]))
  // Files whose upstream SHA changed (or haven't been seen before).
  const changedPaths = new Set<string>(
    options.full
      ? tree.map((f) => f.path)
      : tree.filter((f) => prevByPath.get(f.path)?.sha !== f.sha).map((f) => f.path),
  )

  const summary: RunSummary = {
    projectId: project.id,
    filesScanned: tree.length,
    filesChanged: changedPaths.size,
    filesTranslated: 0,
    blocksTranslated: 0,
    cacheHits: 0,
    failures: 0,
    upstreamSha,
  }

  const trackedFiles: TrackedFile[] = []
  const allFailedBlocks: FailedBlock[] = []

  const fileLimit = pLimit(options.filesInParallel ?? 1)
  const blocksPerFile = options.blocksPerFile ?? 3

  // Process ALL files in the tree — write every file to disk so the docs
  // directories always exist for the VitePress build, regardless of whether
  // any upstream content changed. For unchanged files every block will be a
  // cache hit (no LLM calls).
  const fileResults = await Promise.all(
    tree.map((entry) =>
      fileLimit(async (): Promise<FileResult> => {
        const markdown = await fetchFileContent(project, entry.path)
        const blocks = splitFile(markdown, entry.path)
        const blockResults = await translateAllBlocks(
          blocks,
          providers,
          memory,
          glossary,
          project.id,
          upstreamSha,
          blocksPerFile,
        )

        const fileFailed: FailedBlock[] = []
        let fileCacheHits = 0
        let fileTranslated = 0
        let fileFailures = 0

        for (const r of blockResults) {
          if (r.cacheHit) fileCacheHits++
          else if (r.status === 'ok') fileTranslated++
          if (r.status === 'failed') {
            fileFailures++
            fileFailed.push({
              blockId: r.blockId,
              reason: r.failReason ?? 'unknown',
              sourceHash: r.sourceHash,
              timestamp: new Date().toISOString(),
            })
          }
        }

        const parts: AssembledBlock[] = blocks.map((block, i) => ({
          block,
          translated: blockResults[i]!.translated,
        }))
        const assembled = assembleFile(parts)

        writeTranslatedFile({
          project,
          relativePath: entry.relativePath,
          body: assembled,
          upstreamSha,
          upstreamPath: entry.path,
          ourRepo: options.ourRepo,
          ...(options.docsRoot ? { docsRoot: options.docsRoot } : {}),
        })

        return {
          entry,
          tracked: {
            path: entry.path,
            sha: entry.sha,
            translatedAt: new Date().toISOString(),
            blockHashes: blocks.map((b) => b.sourceHash),
          },
          cacheHits: fileCacheHits,
          blocksTranslated: fileTranslated,
          failures: fileFailures,
          failedBlocks: fileFailed,
        }
      }),
    ),
  )

  for (const r of fileResults) {
    summary.cacheHits += r.cacheHits
    summary.blocksTranslated += r.blocksTranslated
    summary.failures += r.failures
    summary.filesTranslated++
    trackedFiles.push(r.tracked)
    allFailedBlocks.push(...r.failedBlocks)
  }

  const trackedByPath = new Map(trackedFiles.map((f) => [f.path, f]))
  const finalFiles: TrackedFile[] = tree.map((f) => {
    const justTranslated = trackedByPath.get(f.path)
    if (justTranslated) return justTranslated
    const prevTracked = prevByPath.get(f.path)
    return prevTracked ?? { path: f.path, sha: f.sha }
  })

  const newState: ProjectState = {
    projectId: project.id,
    lastSyncTime: new Date().toISOString(),
    lastSyncSha: upstreamSha,
    fileCount: tree.length,
    translatedCount: summary.blocksTranslated + summary.cacheHits,
    cacheHitCount: summary.cacheHits,
    files: finalFiles,
    failedBlocks: allFailedBlocks,
  }
  writeState(newState)

  return summary
}

interface BlockOutcome {
  blockId: string
  sourceHash: string
  translated: string
  cacheHit: boolean
  status: 'ok' | 'failed'
  failReason?: string
}

async function translateAllBlocks(
  blocks: readonly Block[],
  providers: readonly TranslationProvider[],
  memory: TranslationMemory,
  glossary: readonly GlossaryEntry[],
  projectId: string,
  upstreamCommitSha: string,
  concurrency: number,
): Promise<BlockOutcome[]> {
  const limit = pLimit(concurrency)
  const tasks = blocks.map((block) =>
    limit(async (): Promise<BlockOutcome> => {
      const applicable = matchGlossary(block.source, glossary)
      const res = await translateBlock(
        { block, glossaryEntries: applicable, projectId, upstreamCommitSha },
        providers,
        memory,
      )
      return {
        blockId: block.id,
        sourceHash: block.sourceHash,
        translated: res.translated,
        cacheHit: res.cacheHit,
        status: res.status,
        ...(res.failReason ? { failReason: res.failReason } : {}),
      }
    }),
  )
  return await Promise.all(tasks)
}
