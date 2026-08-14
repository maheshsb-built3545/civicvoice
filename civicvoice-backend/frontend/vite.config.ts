import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'dashboard.html'),
        officer: resolve(__dirname, 'officer-dashboard.html'),
        citizen: resolve(__dirname, 'citizen-dashboard.html')
      }
    },
    outDir: '../public',
    emptyOutDir: false
  }
})
