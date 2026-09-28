import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: {
        perFile: true,
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
})
