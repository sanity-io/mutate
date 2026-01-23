import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3333,
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {target: '18'}]],
      },
    }),
  ],
})
