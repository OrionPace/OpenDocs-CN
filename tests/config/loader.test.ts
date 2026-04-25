import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/config/loader.js'

describe('loadConfig', () => {
  it('loads and validates all three config files without throwing', () => {
    const config = loadConfig()
    expect(config.projects.projects).toHaveLength(2)
    expect(config.projects.projects.map((p) => p.id).sort()).toEqual(['codex', 'gemini-cli'])
  })

  it('primary provider is deepseek (required)', () => {
    const { providers } = loadConfig().providers
    expect(providers[0]?.name).toBe('deepseek')
    expect(providers[0]?.optional).toBe(false)
  })

  it('nvidia-nim and openrouter are optional fallbacks', () => {
    const { providers } = loadConfig().providers
    const nim = providers.find((p) => p.name === 'nvidia-nim')
    const openrouter = providers.find((p) => p.name === 'openrouter')
    expect(nim?.optional).toBe(true)
    expect(openrouter?.optional).toBe(true)
  })

  it('no pro-upgrade model exposed in providers.yml (cost control)', () => {
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
