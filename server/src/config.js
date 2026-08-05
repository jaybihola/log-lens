import path from 'node:path';
import os from 'node:os';

export const STATE_FILE = path.join(os.homedir(), '.log-lens-state.json');
export const SETTINGS_FILE = path.join(process.cwd(), 'log-lens.settings.json');
export const ENV_FILE = path.join(process.cwd(), '.env');

const cliPath = process.argv[2] || process.env.LOG_FILE || null;

export const config = {
  initialPath: cliPath,
  port: Number(process.argv[3] || process.env.LOG_LENS_PORT || 7772),
  maxLines: Number(process.env.LOG_LENS_MAX_LINES || 5000),
  pollMs: Number(process.env.LOG_LENS_POLL_MS || 300),
};
