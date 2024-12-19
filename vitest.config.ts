import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    typecheck: {
      tsconfig: 'tsconfig.dist.json',
    },
    coverage: {
      include: ['src/**'],
      reporter: ['text-summary', 'json', 'html'],
    },
  },
})
