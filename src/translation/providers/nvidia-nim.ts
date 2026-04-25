import OpenAI from 'openai'
import type { ProviderCallResult, TranslationProvider } from './interface.js'

/**
 * NVIDIA NIM provider — OpenAI-compatible endpoint.
 * Free endpoint for deepseek-ai/deepseek-v4-flash (rate-limited but no cost).
 * Base URL: https://integrate.api.nvidia.com/v1
 */
export class NvidiaNimProvider implements TranslationProvider {
  readonly name = 'nvidia-nim'
  readonly model: string
  private readonly client: OpenAI

  constructor(opts: { apiKey: string; model?: string; baseUrl?: string }) {
    if (!opts.apiKey) throw new Error('NvidiaNimProvider: apiKey is required')
    this.model = opts.model ?? 'deepseek-ai/deepseek-v4-flash'
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl ?? 'https://integrate.api.nvidia.com/v1',
      timeout: 60_000,
    })
  }

  async translate(prompt: string, maxTokens: number): Promise<ProviderCallResult> {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.1,
    })
    const choice = resp.choices[0]
    const text = choice?.message?.content ?? ''
    return {
      text,
      tokensInput: resp.usage?.prompt_tokens,
      tokensOutput: resp.usage?.completion_tokens,
      model: this.model,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 4,
      })
      return Boolean(resp.choices[0]?.message?.content !== undefined)
    } catch {
      return false
    }
  }
}
