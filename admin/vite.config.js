import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // 将 Origin 改写为后端允许的来源，避免 CORS 403
            proxyReq.setHeader('Origin', 'http://localhost:5173')
          })
        }
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
