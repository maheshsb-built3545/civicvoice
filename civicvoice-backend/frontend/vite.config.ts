import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    rollupOptions: {
      input: {
        landing: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'dashboard.html'),
        officer: path.resolve(__dirname, 'officer-dashboard.html'),
        citizen: path.resolve(__dirname, 'citizen-dashboard.html')
      }
    },
    outDir: 'dist',
    emptyOutDir: false
  }
})
