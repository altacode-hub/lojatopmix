import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname, 'apps/painel'),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist/painel'),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
})
