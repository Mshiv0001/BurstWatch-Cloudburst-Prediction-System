import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      ignored: [
        '**/backend/**',
        '**/backend/data/**',
        '**/data/**',
        '**/dist/**',
        '**/*.db',
        '**/*.db-journal',
        '**/*.sqlite*',
        '**/*.log',
        '**/scratch/**',
        '**/.venv/**',
        '**/__pycache__/**',
        '**/terrain_cache.json'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  optimizeDeps: {
    exclude: ['maplibre-gl']
  }
})