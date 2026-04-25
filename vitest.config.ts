import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 10_000,
    // Isolate every file in its own process so tests that chdir() or use
    // SQLite on disk don't leak state across files.
    pool: 'forks',
  },
})
