import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    typecheck: {
      tsconfig: 'tsconfig.dist.json',
    },
    coverage: {
      reporter: ['text-summary', 'json', 'html'],
    },
  },
})
