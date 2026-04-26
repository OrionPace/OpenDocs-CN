/** All cross-module types for the file-level translation pipeline. */

export interface GlossaryEntry {
  source: string
  target: string
  caseSensitive?: boolean
  note?: string
}

export interface CacheKey {
  /** SHA-256 of the source chunk text (whole file or one H2-bounded chunk). */
  sourceHash: string
  glossaryHash: string
  promptVersion: string
}

export interface FileChunk {
  /** Stable id, e.g. "0", "1" — index within the file's chunk list. */
  index: number
  /** Verbatim source text for this chunk. */
  source: string
  /** SHA-256 of the source. */
  sourceHash: string
  /** True if this chunk is the start of the file (carries frontmatter). */
  isFirst: boolean
  /** True if this chunk is the last of the file. */
  isLast: boolean
}

export interface TranslationRequest {
  chunk: FileChunk
  /** Path of the upstream file, for prompt context only. */
  upstreamPath: string
  /** Project id ("gemini-cli", "codex"). */
  projectId: string
  /** Pinned upstream commit SHA, stored in cache for traceability. */
  upstreamCommitSha: string
  /** Glossary entries that match this chunk's source text. */
  glossaryEntries: GlossaryEntry[]
}

export interface TranslationResponse {
  translated: string
  cacheHit: boolean
  providerUsed?: string
  modelUsed?: string
  tokensUsed?: number
  retryCount?: number
  /** Set when finish_reason='length' — output was truncated. */
  truncated?: boolean
  status: 'ok' | 'failed'
  failReason?: string
}

export interface FailedFile {
  path: string
  reason: string
  sourceHash: string
  timestamp: string
}

export interface QACheck {
  name: string
  passed: boolean
  details?: string
}

export interface FileQAResult {
  filePath: string
  passed: boolean
  checks: QACheck[]
}

export interface QAReport {
  generatedAt: string
  overallPass: boolean
  fileResults: FileQAResult[]
}

/** Entry in state/{projectId}.json tracking one source file. */
export interface TrackedFile {
  /** Upstream path, e.g. "docs/cli/index.md". */
  path: string
  /** Git blob SHA of the upstream file when last translated. */
  sha: string
  translatedAt?: string
}

export interface ProjectState {
  projectId: string
  lastSyncTime: string
  lastSyncSha: string
  fileCount: number
  filesTranslated: number
  filesCacheHit: number
  files: TrackedFile[]
  failedFiles: FailedFile[]
  qaReport?: QAReport
}
