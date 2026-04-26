import Database, { type Database as DB } from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { CacheKey } from './types.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS translations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source_hash      TEXT    NOT NULL,
  glossary_hash    TEXT    NOT NULL,
  prompt_version   TEXT    NOT NULL,
  source_text      TEXT    NOT NULL,
  translated_text  TEXT    NOT NULL,
  project_id       TEXT    NOT NULL,
  upstream_path    TEXT    NOT NULL,
  chunk_index      INTEGER NOT NULL DEFAULT 0,
  provider         TEXT,
  model            TEXT,
  tokens_input     INTEGER,
  tokens_output    INTEGER,
  retry_count      INTEGER DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'ok',
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

export type MemoryStatus = 'ok' | 'failed'

export interface MemoryRecord {
  translatedText: string
  status: MemoryStatus
  sourceText: string
}

export interface SetRecordInput {
  projectId: string
  upstreamPath: string
  chunkIndex: number
  sourceText: string
  translatedText: string
  provider?: string
  model?: string
  tokensInput?: number
  tokensOutput?: number
  retryCount?: number
  status?: MemoryStatus
  upstreamSha?: string
}

/**
 * SQLite-backed translation cache, keyed by (source_hash, glossary_hash,
 * prompt_version). One file per project. WAL mode for concurrent writes
 * during parallel translation.
 *
 * The unit of caching is a "chunk" — usually a whole markdown file, but
 * H2-section-sized for files larger than the model's max_tokens budget.
 */
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
      `SELECT translated_text, status, source_text
       FROM translations
       WHERE source_hash = ? AND glossary_hash = ? AND prompt_version = ?`,
    )

    this.upsertStmt = this.db.prepare(
      `INSERT INTO translations (
        source_hash, glossary_hash, prompt_version,
        source_text, translated_text,
        project_id, upstream_path, chunk_index,
        provider, model, tokens_input, tokens_output,
        retry_count, status, upstream_sha,
        updated_at
      ) VALUES (
        @source_hash, @glossary_hash, @prompt_version,
        @source_text, @translated_text,
        @project_id, @upstream_path, @chunk_index,
        @provider, @model, @tokens_input, @tokens_output,
        @retry_count, @status, @upstream_sha,
        datetime('now')
      )
      ON CONFLICT(source_hash, glossary_hash, prompt_version)
      DO UPDATE SET
        translated_text  = excluded.translated_text,
        provider         = excluded.provider,
        model            = excluded.model,
        tokens_input     = excluded.tokens_input,
        tokens_output    = excluded.tokens_output,
        retry_count      = excluded.retry_count,
        status           = excluded.status,
        upstream_sha     = excluded.upstream_sha,
        updated_at       = datetime('now')`,
    )

    this.failStmt = this.db.prepare(
      `UPDATE translations
       SET status = 'failed', updated_at = datetime('now')
       WHERE source_hash = ? AND glossary_hash = ? AND prompt_version = ?`,
    )
  }

  get(key: CacheKey): MemoryRecord | null {
    const row = this.getStmt.get(key.sourceHash, key.glossaryHash, key.promptVersion) as
      | { translated_text: string; status: MemoryStatus; source_text: string }
      | undefined
    if (!row) return null
    return {
      translatedText: row.translated_text,
      status: row.status,
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
      project_id: input.projectId,
      upstream_path: input.upstreamPath,
      chunk_index: input.chunkIndex,
      provider: input.provider ?? null,
      model: input.model ?? null,
      tokens_input: input.tokensInput ?? null,
      tokens_output: input.tokensOutput ?? null,
      retry_count: input.retryCount ?? 0,
      status: input.status ?? 'ok',
      upstream_sha: input.upstreamSha ?? null,
    })
  }

  markFailed(key: CacheKey): void {
    this.failStmt.run(key.sourceHash, key.glossaryHash, key.promptVersion)
  }

  close(): void {
    this.db.close()
  }
}
