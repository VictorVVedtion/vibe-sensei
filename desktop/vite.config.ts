import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],
  root: 'renderer',
  publicDir: path.resolve(__dirname, '..', 'assets'),
  build: {
    outDir: '../dist/renderer',
  },
  server: {
    port: 5173,
  },
})
