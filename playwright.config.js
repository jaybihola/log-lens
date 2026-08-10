import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SERVER_PORT, CLIENT_PORT } from './e2e/ports.js';

// A completely throwaway HOME (also used as the server process's cwd, since
// config.js's SETTINGS_FILE/ENV_FILE are cwd-relative, not home-relative) —
// this repo has a real server/log-lens.settings.json used for local dev, and
// every *_STATE_FILE/*_SCRATCHES_DIR path in config.js is keyed off
// os.homedir(). Without this, E2E runs would read/write real developer state.
const E2E_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'log-lens-e2e-'));

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false, // shared server-side state (tabs/scratches) across specs
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `node ${path.resolve('server/src/index.js')}`,
      cwd: E2E_HOME,
      env: { ...process.env, HOME: E2E_HOME, LOG_LENS_PORT: String(SERVER_PORT) },
      port: SERVER_PORT,
      reuseExistingServer: false,
      timeout: 15000,
    },
    {
      command: `npx vite --port ${CLIENT_PORT}`,
      cwd: path.resolve('client'),
      env: { ...process.env, LOG_LENS_BACKEND: `http://localhost:${SERVER_PORT}` },
      port: CLIENT_PORT,
      reuseExistingServer: false,
      timeout: 15000,
    },
  ],
});
