export interface ProviderCallResult {
  text: string
  tokensInput?: number
  tokensOutput?: number
  model: string
  /** True when the model stopped because it hit max_tokens. */
  truncated?: boolean
}

export interface TranslationProvider {
  readonly name: string
  readonly model: string
  translate(prompt: string, maxTokens: number): Promise<ProviderCallResult>
  healthCheck(): Promise<boolean>
}
