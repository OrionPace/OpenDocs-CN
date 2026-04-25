import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import type { ProjectState } from '../translation/types.js'

function statePath(projectId: string): string {
  return resolve(process.cwd(), 'state', `${projectId}.json`)
}

export function readState(projectId: string): ProjectState | null {
  const p = statePath(projectId)
  if (!existsSync(p)) return null
  const raw = readFileSync(p, 'utf8')
  return JSON.parse(raw) as ProjectState
}

export function writeState(state: ProjectState): void {
  const p = statePath(state.projectId)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

export function emptyState(projectId: string): ProjectState {
  return {
    projectId,
    lastSyncTime: new Date().toISOString(),
    lastSyncSha: '',
    fileCount: 0,
    translatedCount: 0,
    cacheHitCount: 0,
    files: [],
    failedBlocks: [],
  }
}
