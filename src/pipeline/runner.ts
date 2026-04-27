import pLimit from 'p-limit'
import type { ProjectConfig } from '../config/schema.js'
import { fetchBranchSha, fetchFileContent, fetchFileTree, type FileEntry } from '../sync/github.js'
import { emptyState, readState, writeState } from '../sync/state.js'
import { chunkFile, joinChunks } from '../translation/chunker.js'
import { translateChunk } from '../translation/engine.js'
import { repairHtmlBalance, escapeNonStandardHtmlTags } from '../translation/file-qa.js'
import { matchGlossary } from '../translation/glossary.js'
import type { TranslationMemory } from '../translation/memory.js'
import type { TranslationProvider } from '../translation/providers/interface.js'
import type { FailedFile, GlossaryEntry, ProjectState, TrackedFile } from '../translation/types.js'
import { writeTranslatedFile } from './writer.js'

export interface RunOptions {
  /** Force re-translation of every file regardless of cache. */
  full?: boolean
  /** How many files to process concurrently. */
  filesInParallel?: number
  /** How many chunks within a single file to translate concurrently.
   *  Most files are 1 chunk, so this rarely matters. */
  chunksPerFile?: number
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
  filesCacheHit: number
  failures: number
  upstreamSha: string
}

interface FileResult {
  entry: FileEntry
  tracked: TrackedFile
  fullyCached: boolean
  failed: boolean
  failReason?: string
}

/**
 * Sync one project end-to-end: fetch tree → translate every file (cache hit
 * for unchanged content) → write to disk → update state. Always writes ALL
 * files in the tree so the docs/ output directory is consistent regardless of
 * which files changed upstream.
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

  const summary: RunSummary = {
    projectId: project.id,
    filesScanned: tree.length,
    filesChanged: 0,
    filesTranslated: 0,
    filesCacheHit: 0,
    failures: 0,
    upstreamSha,
  }

  const failedFiles: FailedFile[] = []
  const trackedFiles: TrackedFile[] = []

  const fileLimit = pLimit(options.filesInParallel ?? 1)
  const chunksPerFile = options.chunksPerFile ?? 1

  const fileResults = await Promise.all(
    tree.map((entry) =>
      fileLimit(async (): Promise<FileResult> => {
        const result = await translateOneFile({
          project,
          entry,
          providers,
          memory,
          glossary,
          upstreamSha,
          ourRepo: options.ourRepo,
          chunksPerFile,
          ...(options.docsRoot ? { docsRoot: options.docsRoot } : {}),
        })
        return result
      }),
    ),
  )

  for (const r of fileResults) {
    if (prevByPath.get(r.entry.path)?.sha !== r.entry.sha) summary.filesChanged++
    if (r.fullyCached) summary.filesCacheHit++
    else if (!r.failed) summary.filesTranslated++
    if (r.failed) {
      summary.failures++
      failedFiles.push({
        path: r.entry.path,
        reason: r.failReason ?? 'unknown',
        sourceHash: r.tracked.sha,
        timestamp: new Date().toISOString(),
      })
    }
    trackedFiles.push(r.tracked)
  }

  const newState: ProjectState = {
    projectId: project.id,
    lastSyncTime: new Date().toISOString(),
    lastSyncSha: upstreamSha,
    fileCount: tree.length,
    filesTranslated: summary.filesTranslated,
    filesCacheHit: summary.filesCacheHit,
    files: trackedFiles,
    failedFiles,
  }
  writeState(newState)

  return summary
}

interface TranslateOneInput {
  project: ProjectConfig
  entry: FileEntry
  providers: readonly TranslationProvider[]
  memory: TranslationMemory
  glossary: readonly GlossaryEntry[]
  upstreamSha: string
  ourRepo: string
  chunksPerFile: number
  docsRoot?: string
}

async function translateOneFile(input: TranslateOneInput): Promise<FileResult> {
  const { project, entry, providers, memory, glossary, upstreamSha, ourRepo, chunksPerFile } = input
  const source = await fetchFileContent(project, entry.path)
  const chunks = chunkFile(source)

  const limit = pLimit(chunksPerFile)
  const chunkOutcomes = await Promise.all(
    chunks.map((chunk) =>
      limit(async () => {
        const applicable = matchGlossary(chunk.source, glossary)
        const res = await translateChunk(
          {
            chunk,
            upstreamPath: entry.path,
            projectId: project.id,
            upstreamCommitSha: upstreamSha,
            glossaryEntries: applicable,
          },
          providers,
          memory,
        )
        return { res, source: chunk.source }
      }),
    ),
  )

  const allCacheHit = chunkOutcomes.every((c) => c.res.cacheHit)
  const anyFailed = chunkOutcomes.some((c) => c.res.status === 'failed')
  const failReason = chunkOutcomes.find((c) => c.res.failReason)?.res.failReason

  const assembled = escapeNonStandardHtmlTags(
    repairHtmlBalance(joinChunks(chunkOutcomes.map((c) => c.res.translated))),
  )

  writeTranslatedFile({
    project,
    relativePath: entry.relativePath,
    body: assembled,
    upstreamSha,
    upstreamPath: entry.path,
    ourRepo,
    ...(input.docsRoot ? { docsRoot: input.docsRoot } : {}),
  })

  return {
    entry,
    tracked: {
      path: entry.path,
      sha: entry.sha,
      translatedAt: new Date().toISOString(),
    },
    fullyCached: allCacheHit,
    failed: anyFailed,
    ...(failReason ? { failReason } : {}),
  }
}
