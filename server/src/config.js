import path from 'node:path';
import os from 'node:os';

export const STATE_FILE = path.join(os.homedir(), '.log-lens-state.json');
export const SETTINGS_FILE = path.join(process.cwd(), 'log-lens.settings.json');
export const ENV_FILE = path.join(process.cwd(), '.env');

// JSON Lens gets its own persistence file/folder rather than folding into
// STATE_FILE's monolithic blob (see server/src/jsonLens/store.js) — roots +
// scratch metadata, and the scratch file contents themselves.
export const JSON_LENS_STATE_FILE = path.join(os.homedir(), '.log-lens-json-state.json');
export const JSON_LENS_SCRATCHES_DIR = path.join(os.homedir(), '.log-lens-scratches');

// Diff Lens's own scratches — same shape as JSON Lens's (see
// server/src/diffLens/store.js), but its own file/folder since a diff
// scratch stores a small structured object (leftText/rightText/language/
// options), not a single content string.
export const DIFF_LENS_STATE_FILE = path.join(os.homedir(), '.log-lens-diff-state.json');
export const DIFF_LENS_SCRATCHES_DIR = path.join(os.homedir(), '.log-lens-diff-scratches');

// Index field name/type cache, accumulated from real query results (see
// logLens/es/fieldCache.js) — deliberately its own file rather than folded
// into STATE_FILE: it grows indefinitely across every environment+index ever
// queried, an unrelated lifecycle to tabs/credentials/settings.
export const INDEX_FIELDS_STATE_FILE = path.join(os.homedir(), '.log-lens-fields-state.json');

const cliPath = process.argv[2] || process.env.LOG_FILE || null;

export const config = {
  initialPath: cliPath,
  port: Number(process.argv[3] || process.env.LOG_LENS_PORT || 7772),
  maxLines: Number(process.env.LOG_LENS_MAX_LINES || 5000),
  pollMs: Number(process.env.LOG_LENS_POLL_MS || 300),
};
