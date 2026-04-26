import OpenAI from 'openai'
import type { ProviderCallResult, TranslationProvider } from './interface.js'

export class OpenRouterProvider implements TranslationProvider {
  readonly name = 'openrouter'
  readonly model: string
  private readonly client: OpenAI

  constructor(opts: { apiKey: string; model?: string; baseUrl?: string }) {
    if (!opts.apiKey) throw new Error('OpenRouterProvider: apiKey is required')
    this.model = opts.model ?? 'deepseek/deepseek-chat'
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl ?? 'https://openrouter.ai/api/v1',
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
      truncated: choice?.finish_reason === 'length',
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
