import { createHash } from 'node:crypto'
import type { FileChunk } from './types.js'

/**
 * Threshold above which we split a file by H2 headings. Chosen to keep each
 * chunk's expected output within the 8K max_tokens limit of DeepSeek flash
 * and NVIDIA NIM (~4 chars/token, so 25_000 chars ≈ 6_250 input tokens, leaving
 * headroom for the prompt template and similar-sized output).
 */
const CHUNK_THRESHOLD_BYTES = 25_000

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/** Find indices of lines that start an H2 (`## `) outside of fenced code. */
function findH2LineIndices(lines: readonly string[]): number[] {
  const out: number[] = []
  let inFence = false
  let fenceMarker = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trimStart()
    // Track ``` and ~~~ fences. A fence opens with the same marker that closes it.
    if (!inFence) {
      const m = /^(```+|~~~+)/.exec(trimmed)
      if (m) {
        inFence = true
        fenceMarker = m[1]!
        continue
      }
    } else {
      if (trimmed.startsWith(fenceMarker)) {
        inFence = false
        fenceMarker = ''
      }
      continue
    }
    if (/^## /.test(trimmed)) out.push(i)
  }
  return out
}

/**
 * Split a Markdown file into translation chunks.
 *   - Files <= CHUNK_THRESHOLD_BYTES → single chunk (whole file).
 *   - Larger files → split at H2 boundaries, packing greedily so each chunk
 *     stays under the threshold. Frontmatter and pre-H2 intro stay with the
 *     first chunk.
 *
 * If a file is large but has no H2 headings, it returns one chunk. The engine
 * may still get a truncated response; QA will flag it.
 */
export function chunkFile(source: string): FileChunk[] {
  if (source.length <= CHUNK_THRESHOLD_BYTES) {
    return [
      {
        index: 0,
        source,
        sourceHash: sha256(source),
        isFirst: true,
        isLast: true,
      },
    ]
  }

  const lines = source.split('\n')
  const h2Lines = findH2LineIndices(lines)

  // No H2 boundaries to split on — return single chunk and let QA flag truncation.
  if (h2Lines.length === 0) {
    return [
      {
        index: 0,
        source,
        sourceHash: sha256(source),
        isFirst: true,
        isLast: true,
      },
    ]
  }

  // Sections start at index 0 (everything before first H2) and at every H2.
  const sectionStarts = [0, ...h2Lines]
  const sectionEnds: number[] = []
  for (let i = 0; i < sectionStarts.length; i++) {
    sectionEnds.push(i + 1 < sectionStarts.length ? sectionStarts[i + 1]! : lines.length)
  }
  const sections = sectionStarts.map((start, i) => lines.slice(start, sectionEnds[i]).join('\n'))

  // Greedy packing: keep accumulating sections into a chunk until adding the
  // next would exceed the threshold.
  const chunks: string[] = []
  let buf = ''
  for (const section of sections) {
    if (buf.length === 0) {
      buf = section
      continue
    }
    if (buf.length + 1 + section.length > CHUNK_THRESHOLD_BYTES) {
      chunks.push(buf)
      buf = section
    } else {
      buf = buf + '\n' + section
    }
  }
  if (buf.length > 0) chunks.push(buf)

  return chunks.map((src, i) => ({
    index: i,
    source: src,
    sourceHash: sha256(src),
    isFirst: i === 0,
    isLast: i === chunks.length - 1,
  }))
}

/** Reassemble translated chunks back into one file body. */
export function joinChunks(translatedChunks: readonly string[]): string {
  if (translatedChunks.length === 0) return ''
  if (translatedChunks.length === 1) return translatedChunks[0]!
  // Each chunk after the first starts with an H2, so '\n' is the right joiner.
  return translatedChunks.map((c) => c.replace(/\n+$/, '')).join('\n\n') + '\n'
}
