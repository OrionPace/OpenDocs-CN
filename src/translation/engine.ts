import pRetry from 'p-retry'
import { runFileQA, type FileQAOutcome } from './file-qa.js'
import { computeGlossaryHash } from './glossary.js'
import type { TranslationMemory } from './memory.js'
import { PROMPT_VERSION, buildPrompt } from './prompt.js'
import type { TranslationProvider } from './providers/interface.js'
import type { CacheKey, TranslationRequest, TranslationResponse } from './types.js'

const MAX_OUTPUT_TOKENS = 8000

interface CallOutcome {
  text: string
  tokensInput?: number
  tokensOutput?: number
  model: string
  truncated?: boolean
}

async function callWithBackoff(
  provider: TranslationProvider,
  prompt: string,
): Promise<CallOutcome> {
  // Only transport errors (network, 429, 5xx) retry here. Content-level
  // problems (empty output, QA failure) are handled by the engine below,
  // which decides whether to retry with a stricter prompt or move to the
  // next provider.
  return await pRetry(() => provider.translate(prompt, MAX_OUTPUT_TOKENS), {
    retries: 1,
    minTimeout: 2000,
    factor: 2,
    maxTimeout: 10_000,
  })
}

function strictRetryPrompt(prompt: string, qa: FileQAOutcome): string {
  const reminder = qa.failures.map((f) => `- ${f.name}: ${f.details}`).join('\n')
  return [
    prompt,
    '',
    '[CRITICAL — your previous output violated these constraints]',
    reminder,
    '[END CRITICAL]',
    '',
    'Translate again. Obey every rule strictly. Output ONLY the translated Markdown.',
  ].join('\n')
}

/**
 * Translate one chunk (whole-file or H2 section). Flow:
 *   1. cache hit → return
 *   2. for each provider in order:
 *        call → QA → if fail, one stricter retry on same provider → next provider
 *   3. all providers exhausted → mark failed, return source as placeholder
 */
export async function translateChunk(
  req: TranslationRequest,
  providers: readonly TranslationProvider[],
  memory: TranslationMemory,
): Promise<TranslationResponse> {
  const { chunk, glossaryEntries, projectId, upstreamCommitSha, upstreamPath } = req

  const glossaryHash = computeGlossaryHash(glossaryEntries)
  const key: CacheKey = {
    sourceHash: chunk.sourceHash,
    glossaryHash,
    promptVersion: PROMPT_VERSION,
  }
  const cached = memory.get(key)
  if (cached && cached.status === 'ok') {
    return { translated: cached.translatedText, cacheHit: true, status: 'ok' }
  }

  if (providers.length === 0) {
    throw new Error('translateChunk: no providers configured')
  }

  const prompt = buildPrompt(req, glossaryEntries)
  let retryCount = 0
  let lastFail = 'no providers tried'

  for (const provider of providers) {
    try {
      const res1 = await callWithBackoff(provider, prompt)
      const qa1 = runFileQA(chunk.source, res1.text, glossaryEntries)
      if (qa1.passed && !res1.truncated) {
        memory.set(key, {
          projectId,
          upstreamPath,
          chunkIndex: chunk.index,
          sourceText: chunk.source,
          translatedText: res1.text,
          provider: provider.name,
          model: res1.model,
          tokensInput: res1.tokensInput,
          tokensOutput: res1.tokensOutput,
          retryCount,
          status: 'ok',
          upstreamSha: upstreamCommitSha,
        })
        return {
          translated: res1.text,
          cacheHit: false,
          providerUsed: provider.name,
          modelUsed: res1.model,
          tokensUsed: (res1.tokensInput ?? 0) + (res1.tokensOutput ?? 0),
          retryCount,
          status: 'ok',
        }
      }

      // One stricter retry on the same provider.
      retryCount++
      const reason = res1.truncated
        ? {
            passed: false,
            failures: [{ name: 'truncated', passed: false, details: 'finish_reason=length' }],
          }
        : qa1
      const res2 = await callWithBackoff(provider, strictRetryPrompt(prompt, reason))
      const qa2 = runFileQA(chunk.source, res2.text, glossaryEntries)
      if (qa2.passed && !res2.truncated) {
        memory.set(key, {
          projectId,
          upstreamPath,
          chunkIndex: chunk.index,
          sourceText: chunk.source,
          translatedText: res2.text,
          provider: provider.name,
          model: res2.model,
          tokensInput: res2.tokensInput,
          tokensOutput: res2.tokensOutput,
          retryCount,
          status: 'ok',
          upstreamSha: upstreamCommitSha,
        })
        return {
          translated: res2.text,
          cacheHit: false,
          providerUsed: provider.name,
          modelUsed: res2.model,
          tokensUsed: (res2.tokensInput ?? 0) + (res2.tokensOutput ?? 0),
          retryCount,
          status: 'ok',
        }
      }

      lastFail = res2.truncated
        ? `${provider.name}: output truncated`
        : `${provider.name}: ${qa2.failures.map((f) => f.name).join(',')}`
    } catch (err) {
      lastFail = `${provider.name}: ${(err as Error).message}`
    }
  }

  // All providers exhausted — fail open with source as placeholder so the
  // build still has something to render.
  memory.set(key, {
    projectId,
    upstreamPath,
    chunkIndex: chunk.index,
    sourceText: chunk.source,
    translatedText: chunk.source,
    status: 'failed',
    upstreamSha: upstreamCommitSha,
  })
  memory.markFailed(key)
  return {
    translated: chunk.source,
    cacheHit: false,
    retryCount,
    status: 'failed',
    failReason: lastFail,
  }
}
