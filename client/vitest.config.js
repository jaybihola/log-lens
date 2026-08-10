import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.js so dev/build stay untouched by test-only
// concerns (jsdom, setup file) — same plugin, different config file.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    css: false,
    // Node 22+'s own experimental global `localStorage` (undefined/broken
    // unless --localstorage-file is set) claims the property before jsdom's
    // environment setup gets a chance to define its real implementation —
    // this flag keeps Node from defining it at all, so jsdom's version wins.
    execArgv: ['--no-experimental-webstorage'],
  },
});
