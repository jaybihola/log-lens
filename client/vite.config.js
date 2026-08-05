import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.LOG_LENS_BACKEND || 'http://localhost:7772'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backend,
        // SSE streams need the connection kept open rather than buffered.
        ws: false,
      },
    },
  },
})
