import { z } from 'zod'

export const ProjectConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),
  name: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().min(1),
  docsPath: z.string().min(1),
  route: z.string().regex(/^\/[a-z0-9-]+\/$/, 'route must look like "/project-id/"'),
  upstreamUrl: z.string().url(),
  license: z.string().min(1),
})

export const ProjectsFileSchema = z.object({
  projects: z.array(ProjectConfigSchema).min(1),
  ourRepo: z.string().regex(/^[^/]+\/[^/]+$/, 'ourRepo must be "owner/repo"'),
})

export const ProviderConfigSchema = z.object({
  name: z.enum(['deepseek', 'openrouter', 'nvidia-nim']),
  baseUrl: z.string().url(),
  defaultModel: z.string().min(1),
  envKey: z.string().min(1),
  modelEnvKey: z.string().optional(),
  optional: z.boolean().default(false),
})

export const ProvidersFileSchema = z.object({
  providers: z.array(ProviderConfigSchema).min(1),
  maxBlockTokens: z.number().int().positive().default(1500),
  concurrency: z
    .object({
      blocksPerFile: z.number().int().positive().default(3),
      filesInParallel: z.number().int().positive().default(1),
    })
    .default({ blocksPerFile: 3, filesInParallel: 1 }),
})

export const GlossaryEntrySchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  caseSensitive: z.boolean().optional(),
  note: z.string().optional(),
})

export const GlossaryFileSchema = z.object({
  terms: z.array(GlossaryEntrySchema),
})

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>
export type ProjectsFile = z.infer<typeof ProjectsFileSchema>
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>
export type ProvidersFile = z.infer<typeof ProvidersFileSchema>
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>
export type GlossaryFile = z.infer<typeof GlossaryFileSchema>

export interface Config {
  projects: ProjectsFile
  providers: ProvidersFile
  glossary: GlossaryFile
}
