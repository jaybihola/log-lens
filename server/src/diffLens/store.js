import fs from 'node:fs';
import path from 'node:path';
import { DIFF_LENS_STATE_FILE, DIFF_LENS_SCRATCHES_DIR } from '../config.js';

// Mirrors server/src/jsonLens/store.js's persistence shape (metadata in one
// state file, content in its own per-scratch file under a scratches dir) —
// the one real difference is that a diff scratch's "content" is a small
// structured object (leftText/rightText/language/options), not a single
// string, so each scratch file holds JSON rather than raw text.

const EMPTY_DATA = { leftText: '', rightText: '', language: 'plaintext', options: {} };
const DATA_KEYS = ['leftText', 'rightText', 'language', 'options'];

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DIFF_LENS_STATE_FILE, 'utf8'));
    return { scratches: Array.isArray(parsed.scratches) ? parsed.scratches : [] };
  } catch {
    return { scratches: [] };
  }
}

let state = load();

function persist() {
  try {
    fs.writeFileSync(DIFF_LENS_STATE_FILE, JSON.stringify(state));
  } catch {
    // not fatal — persistence just won't survive a restart
  }
}

function scratchPath(id) {
  return path.join(DIFF_LENS_SCRATCHES_DIR, `${id}.json`);
}

export function listScratches() {
  return state.scratches;
}

export function createScratch(name, data) {
  const id = `dscr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  fs.mkdirSync(DIFF_LENS_SCRATCHES_DIR, { recursive: true });
  fs.writeFileSync(scratchPath(id), JSON.stringify({ ...EMPTY_DATA, ...data }));
  const entry = { id, name, updatedAt: Date.now() };
  state.scratches = [...state.scratches, entry];
  persist();
  return entry;
}

export function readScratch(id) {
  const raw = JSON.parse(fs.readFileSync(scratchPath(id), 'utf8'));
  return { ...EMPTY_DATA, ...raw };
}

export function updateScratch(id, patch) {
  const idx = state.scratches.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  if (DATA_KEYS.some((k) => k in patch)) {
    const current = readScratch(id);
    const merged = { ...current };
    for (const k of DATA_KEYS) if (k in patch) merged[k] = patch[k];
    fs.writeFileSync(scratchPath(id), JSON.stringify(merged));
  }
  const nameChange = typeof patch.name === 'string' && patch.name.trim() ? { name: patch.name.trim() } : {};
  const next = [...state.scratches];
  next[idx] = { ...next[idx], ...nameChange, updatedAt: Date.now() };
  state.scratches = next;
  persist();
  return next[idx];
}

export function deleteScratch(id) {
  state.scratches = state.scratches.filter((s) => s.id !== id);
  try {
    fs.unlinkSync(scratchPath(id));
  } catch {
    // already gone — fine
  }
  persist();
}
