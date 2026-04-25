import pRetry from 'p-retry'
import { computeGlossaryHash } from './glossary.js'
import type { TranslationMemory } from './memory.js'
import { PROMPT_VERSION, buildPrompt } from './prompt.js'
import type { TranslationProvider } from './providers/interface.js'
import { runQA, type QAFailure } from './qa.js'
import type { CacheKey, TranslationRequest, TranslationResponse } from './types.js'

const MAX_OUTPUT_TOKENS = 3000

interface CallOutcome {
  text: string
  tokensInput?: number
  tokensOutput?: number
  model: string
}

async function callWithBackoff(
  provider: TranslationProvider,
  prompt: string,
): Promise<CallOutcome> {
  // Only transport errors (network, 429, 5xx) are retried here. Content-level
  // problems (empty output, QA failure) are judged by the engine below, which
  // has access to block context and can route to the stricter-prompt retry or
  // the next provider without burning backoff budget.
  return await pRetry(() => provider.translate(prompt, MAX_OUTPUT_TOKENS), {
    retries: 1,
    minTimeout: 2000,
    factor: 2,
    maxTimeout: 10_000,
  })
}

function strictRetryPrompt(prompt: string, failures: QAFailure[]): string {
  const reminder = failures.map((f) => `- ${f.check}: ${f.details}`).join('\n')
  return [
    prompt,
    '',
    '[CRITICAL — your previous output violated these constraints]',
    reminder,
    '[END CRITICAL]',
    '',
    'Translate again. Obey the rules strictly. Output ONLY the translated Markdown block.',
  ].join('\n')
}

/**
 * Translate one block. Flow:
 *   1. cache hit ? return
 *   2. non-translatable ? return source verbatim
 *   3. for each provider in order:
 *        call → QA → if fail, one stricter retry on same provider → next provider
 *   4. all providers exhausted ? mark failed, return source as placeholder
 */
export async function translateBlock(
  req: TranslationRequest,
  providers: readonly TranslationProvider[],
  memory: TranslationMemory,
): Promise<TranslationResponse> {
  const { block, glossaryEntries, projectId, upstreamCommitSha } = req

  // 2. Non-translatable blocks never go to the LLM.
  if (!block.translatable) {
    return { translated: block.source, cacheHit: false, status: 'ok' }
  }

  // 1. Cache key + lookup.
  const glossaryHash = computeGlossaryHash(glossaryEntries)
  const key: CacheKey = {
    sourceHash: block.sourceHash,
    glossaryHash,
    promptVersion: PROMPT_VERSION,
  }
  const cached = memory.get(key)
  if (cached && cached.status === 'ok') {
    return { translated: cached.translatedText, cacheHit: true, status: 'ok' }
  }

  if (providers.length === 0) {
    throw new Error('translateBlock: no providers configured')
  }

  // 3. Provider loop with one stricter retry per provider.
  const prompt = buildPrompt(req, glossaryEntries)
  let retryCount = 0
  let lastFail = 'no providers tried'

  for (const provider of providers) {
    try {
      const res1 = await callWithBackoff(provider, prompt)
      const qa1 = runQA(block, res1.text, glossaryEntries)
      if (qa1.passed) {
        memory.set(key, {
          projectId,
          sourceText: block.source,
          translatedText: qa1.repairedText,
          blockType: block.type,
          provider: provider.name,
          model: res1.model,
          tokensInput: res1.tokensInput,
          tokensOutput: res1.tokensOutput,
          retryCount,
          status: 'ok',
          upstreamSha: upstreamCommitSha,
        })
        return {
          translated: qa1.repairedText,
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
      const res2 = await callWithBackoff(provider, strictRetryPrompt(prompt, qa1.failures))
      const qa2 = runQA(block, res2.text, glossaryEntries)
      if (qa2.passed) {
        memory.set(key, {
          projectId,
          sourceText: block.source,
          translatedText: qa2.repairedText,
          blockType: block.type,
          provider: provider.name,
          model: res2.model,
          tokensInput: res2.tokensInput,
          tokensOutput: res2.tokensOutput,
          retryCount,
          status: 'ok',
          upstreamSha: upstreamCommitSha,
        })
        return {
          translated: qa2.repairedText,
          cacheHit: false,
          providerUsed: provider.name,
          modelUsed: res2.model,
          tokensUsed: (res2.tokensInput ?? 0) + (res2.tokensOutput ?? 0),
          retryCount,
          status: 'ok',
        }
      }

      lastFail = `${provider.name}: ${qa2.failures.map((f) => f.check).join(',')}`
    } catch (err) {
      lastFail = `${provider.name}: ${(err as Error).message}`
    }
  }

  // 4. All providers exhausted — fail open with source as placeholder.
  memory.set(key, {
    projectId,
    sourceText: block.source,
    translatedText: block.source,
    blockType: block.type,
    status: 'failed',
    glossaryViolations: [lastFail],
    upstreamSha: upstreamCommitSha,
  })
  memory.markFailed(key, lastFail)
  return {
    translated: block.source,
    cacheHit: false,
    retryCount,
    status: 'failed',
    failReason: lastFail,
  }
}
