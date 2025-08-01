// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Opt-in to the v7 relativeSplatPath future flag
    'process.env.REACT_ROUTER_FUTURE_FLAGS': JSON.stringify({ v7_relativeSplatPath: true })
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,  // 🔧 ADD THIS

        ws: true,
      },
    },
  },
})
