// vite.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const backendEnabled = env.VITE_DEMO_MODE?.trim().toLowerCase() !== 'true' &&
    env.VITE_BACKEND_ENABLED?.trim().toLowerCase() === 'true'
  return {
  define: { __ENERGYIQ_BACKEND_ENABLED__: JSON.stringify(backendEnabled) },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  }
})
