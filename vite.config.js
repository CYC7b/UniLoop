import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'http://localhost:8080',
        ws: true
      },
      '/uploads': 'http://localhost:8080'
    }
  },
  esbuild: {
    drop: ['console', 'debugger']
  }
})
