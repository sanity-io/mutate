import path from 'node:path'

import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3333,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@bjoerge/mutiny': path.resolve(__dirname, '../../src'),
      '@bjoerge/mutiny/_unstable_store': path.resolve(__dirname, '../../src'),
    },
  },
})
