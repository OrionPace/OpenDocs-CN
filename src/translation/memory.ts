import Database, { type Database as DB } from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { BlockType, CacheKey } from './types.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS translations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source_hash      TEXT    NOT NULL,
  glossary_hash    TEXT    NOT NULL,
  prompt_version   TEXT    NOT NULL,
  source_text      TEXT    NOT NULL,
  translated_text  TEXT    NOT NULL,
  block_type       TEXT    NOT NULL,
  project_id       TEXT    NOT NULL,
  file_path        TEXT,
  provider         TEXT,
  model            TEXT,
  tokens_input     INTEGER,
  tokens_output    INTEGER,
  retry_count      INTEGER DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'ok',
  glossary_violations TEXT,
  reviewed         INTEGER DEFAULT 0,
  reviewer         TEXT,
  upstream_sha     TEXT,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now')),
  UNIQUE(source_hash, glossary_hash, prompt_version)
);

CREATE INDEX IF NOT EXISTS idx_cache_key
  ON translations(source_hash, glossary_hash, prompt_version);
CREATE INDEX IF NOT EXISTS idx_project
  ON translations(project_id);
CREATE INDEX IF NOT EXISTS idx_status
  ON translations(status);
`

export type MemoryStatus = 'ok' | 'failed' | 'pending_review'

export interface MemoryRecord {
  translatedText: string
  status: MemoryStatus
  reviewed: boolean
  sourceText: string
}

export interface SetRecordInput {
  projectId: string
  sourceText: string
  translatedText: string
  blockType: BlockType
  filePath?: string
  provider?: string
  model?: string
  tokensInput?: number
  tokensOutput?: number
  retryCount?: number
  status?: MemoryStatus
  glossaryViolations?: string[]
  upstreamSha?: string
}

export class TranslationMemory {
  private readonly db: DB
  private readonly getStmt: Database.Statement
  private readonly upsertStmt: Database.Statement
  private readonly failStmt: Database.Statement

  constructor(projectId: string, opts: { dir?: string } = {}) {
    const baseDir = opts.dir ?? resolve(process.cwd(), 'translation-memory')
    const filepath = resolve(baseDir, `${projectId}.sqlite`)
    mkdirSync(dirname(filepath), { recursive: true })
    this.db = new Database(filepath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)

    this.getStmt = this.db.prepare(
      `SELECT translated_text, status, reviewed, source_text
       FROM translations
       WHERE source_hash = ? AND glossary_hash = ? AND prompt_version = ?`,
    )

    this.upsertStmt = this.db.prepare(
      `INSERT INTO translations (
        source_hash, glossary_hash, prompt_version,
        source_text, translated_text, block_type,
        project_id, file_path, provider, model,
        tokens_input, tokens_output, retry_count,
        status, glossary_violations, upstream_sha,
        updated_at
      ) VALUES (
        @source_hash, @glossary_hash, @prompt_version,
        @source_text, @translated_text, @block_type,
        @project_id, @file_path, @provider, @model,
        @tokens_input, @tokens_output, @retry_count,
        @status, @glossary_violations, @upstream_sha,
        datetime('now')
      )
      ON CONFLICT(source_hash, glossary_hash, prompt_version)
      DO UPDATE SET
        translated_text     = excluded.translated_text,
        provider            = excluded.provider,
        model               = excluded.model,
        tokens_input        = excluded.tokens_input,
        tokens_output       = excluded.tokens_output,
        retry_count         = excluded.retry_count,
        status              = excluded.status,
        glossary_violations = excluded.glossary_violations,
        upstream_sha        = excluded.upstream_sha,
        updated_at          = datetime('now')
      WHERE translations.reviewed = 0`,
    )

    this.failStmt = this.db.prepare(
      `UPDATE translations
       SET status = 'failed', glossary_violations = ?, updated_at = datetime('now')
       WHERE source_hash = ? AND glossary_hash = ? AND prompt_version = ?`,
    )
  }

  get(key: CacheKey): MemoryRecord | null {
    const row = this.getStmt.get(key.sourceHash, key.glossaryHash, key.promptVersion) as
      | {
          translated_text: string
          status: MemoryStatus
          reviewed: number
          source_text: string
        }
      | undefined
    if (!row) return null
    return {
      translatedText: row.translated_text,
      status: row.status,
      reviewed: row.reviewed === 1,
      sourceText: row.source_text,
    }
  }

  set(key: CacheKey, input: SetRecordInput): void {
    this.upsertStmt.run({
      source_hash: key.sourceHash,
      glossary_hash: key.glossaryHash,
      prompt_version: key.promptVersion,
      source_text: input.sourceText,
      translated_text: input.translatedText,
      block_type: input.blockType,
      project_id: input.projectId,
      file_path: input.filePath ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      tokens_input: input.tokensInput ?? null,
      tokens_output: input.tokensOutput ?? null,
      retry_count: input.retryCount ?? 0,
      status: input.status ?? 'ok',
      glossary_violations: input.glossaryViolations
        ? JSON.stringify(input.glossaryViolations)
        : null,
      upstream_sha: input.upstreamSha ?? null,
    })
  }

  markFailed(key: CacheKey, reason: string): void {
    this.failStmt.run(reason, key.sourceHash, key.glossaryHash, key.promptVersion)
  }

  close(): void {
    this.db.close()
  }
}
