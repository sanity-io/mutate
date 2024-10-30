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
      '@sanity/mutate': path.resolve(__dirname, '../../src'),
      '@sanity/mutate/_unstable_local': path.resolve(__dirname, '../../src'),
    },
  },
})
