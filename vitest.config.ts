import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    typecheck: {
      tsconfig: 'tsconfig.dist.json',
    },
    testTimeout: 60_000,
    reporters: [['default', {summary: false}]],
    coverage: {
      include: ['src/**'],
      reporter: ['text-summary', 'json', 'html'],
    },
  },
})
