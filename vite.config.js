import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      ignored: ['**/model_metadata.json', '**/*.log', '**/scratch/**']
    }
  },
  optimizeDeps: {
    exclude: ['maplibre-gl']
  }
})