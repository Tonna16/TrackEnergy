import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  server: {
    proxy: {
      // /auth → /api/auth
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth/, '/api/auth'),
      },
      // /notifications → /api/notifications
      '/notifications': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/notifications/, '/api/notifications'),
      },
      // catch-all /api
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // WebSocket endpoint
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: ['buffer', 'process', 'events', 'stream', 'util', 'crypto', 'path'],
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      path: 'path-browserify',
      util: 'util',
      events: 'events',
    },
  },
});
