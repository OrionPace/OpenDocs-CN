/** All cross-module types used by splitter, memory, engine, pipeline, QA. */

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'code'
  | 'list'
  | 'table'
  | 'blockquote'
  | 'html'
  | 'thematicBreak'
  | 'frontmatter'

export interface Block {
  id: string
  type: BlockType
  source: string
  sourceHash: string
  translatable: boolean
  anchorHint?: string
  customAnchor?: string
  headingLevel?: number
  documentTitle: string
  sectionTitle: string
  prevBlockSource?: string
  nextBlockSource?: string
}

export interface GlossaryEntry {
  source: string
  target: string
  caseSensitive?: boolean
  note?: string
}

export interface CacheKey {
  sourceHash: string
  glossaryHash: string
  promptVersion: string
}

export interface TranslationRequest {
  block: Block
  glossaryEntries: GlossaryEntry[]
  projectId: string
  upstreamCommitSha: string
}

export interface TranslationResponse {
  translated: string
  cacheHit: boolean
  providerUsed?: string
  modelUsed?: string
  tokensUsed?: number
  retryCount?: number
  glossaryViolations?: string[]
  anchorRestored?: boolean
  status: 'ok' | 'failed'
  failReason?: string
}

export interface FailedBlock {
  blockId: string
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
  path: string
  sha: string
  translatedAt?: string
  blockHashes?: string[]
}

export interface ProjectState {
  projectId: string
  lastSyncTime: string
  lastSyncSha: string
  fileCount: number
  translatedCount: number
  cacheHitCount: number
  files: TrackedFile[]
  failedBlocks: FailedBlock[]
  qaReport?: QAReport
}
