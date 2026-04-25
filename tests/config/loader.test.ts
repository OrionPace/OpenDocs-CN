import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/config/loader.js'

describe('loadConfig', () => {
  it('loads and validates all three config files without throwing', () => {
    const config = loadConfig()
    expect(config.projects.projects).toHaveLength(2)
    expect(config.projects.projects.map((p) => p.id).sort()).toEqual(['codex', 'gemini-cli'])
  })

  it('includes both DeepSeek and OpenRouter providers', () => {
    const { providers } = loadConfig().providers
    expect(providers.map((p) => p.name).sort()).toEqual(['deepseek', 'openrouter'])
  })

  it('DeepSeek provider uses deepseek-v4-flash (no pro-upgrade model exposed)', () => {
    const { providers } = loadConfig().providers
    const deepseek = providers.find((p) => p.name === 'deepseek')
    expect(deepseek?.defaultModel).toBe('deepseek-v4-flash')
    // Pro must NOT appear in providers.yml — cost control constraint.
    const yaml = JSON.stringify(loadConfig().providers)
    expect(yaml).not.toContain('deepseek-v4-pro')
    expect(yaml).not.toContain('upgradeModel')
  })

  it('glossary contains at least one entry for a known technical term', () => {
    const { terms } = loadConfig().glossary
    const agent = terms.find((t) => t.source === 'agent')
    expect(agent?.target).toBe('智能体')
  })

  it('every project id is kebab-case', () => {
    const { projects } = loadConfig().projects
    for (const p of projects) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('every project route matches /id/ pattern', () => {
    const { projects } = loadConfig().projects
    for (const p of projects) {
      expect(p.route).toBe(`/${p.id}/`)
    }
  })
})
