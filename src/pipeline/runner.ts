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
  const changed: FileEntry[] = options.full
    ? tree
    : tree.filter((f) => prevByPath.get(f.path)?.sha !== f.sha)

  const summary: RunSummary = {
    projectId: project.id,
    filesScanned: tree.length,
    filesChanged: changed.length,
    filesTranslated: 0,
    blocksTranslated: 0,
    cacheHits: 0,
    failures: 0,
    upstreamSha,
  }

  const failedBlocks: FailedBlock[] = []
  const trackedFiles: TrackedFile[] = []

  for (const entry of changed) {
    const markdown = await fetchFileContent(project, entry.path)
    const blocks = splitFile(markdown, entry.path)
    const blockResults = await translateAllBlocks(
      blocks,
      providers,
      memory,
      glossary,
      project.id,
      upstreamSha,
      options.blocksPerFile ?? 3,
    )

    for (const r of blockResults) {
      if (r.cacheHit) summary.cacheHits++
      else if (r.status === 'ok') summary.blocksTranslated++
      if (r.status === 'failed') {
        summary.failures++
        failedBlocks.push({
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

    summary.filesTranslated++
    trackedFiles.push({
      path: entry.path,
      sha: entry.sha,
      translatedAt: new Date().toISOString(),
      blockHashes: blocks.map((b) => b.sourceHash),
    })
  }

  // Carry forward unchanged files' tracking entries; replace tracked entries
  // for files we just translated.
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
    failedBlocks,
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
