export interface ProviderCallResult {
  text: string
  tokensInput?: number
  tokensOutput?: number
  model: string
}

export interface TranslationProvider {
  readonly name: string
  readonly model: string
  translate(prompt: string, maxTokens: number): Promise<ProviderCallResult>
  healthCheck(): Promise<boolean>
}
