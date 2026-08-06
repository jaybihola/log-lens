import fs from 'node:fs';
import path from 'node:path';
import { JSON_LENS_STATE_FILE, JSON_LENS_SCRATCHES_DIR } from '../config.js';

// Deliberately its own small module instead of folding into ../state.js —
// that file is a single mutable blob (tabs + credentials + settings) that
// every mutating route has to remember to re-persist wholesale via
// registry.js's persistTabs(); miss a call and the change silently doesn't
// survive a restart. Here, every mutator persists itself, immediately, so
// there's no separate "don't forget to save" step to get wrong.
// (server/src/state.js could stand to be split the same way — not done here
// since Log Lens's own behavior isn't part of this change.)

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(JSON_LENS_STATE_FILE, 'utf8'));
    return {
      roots: Array.isArray(parsed.roots) ? parsed.roots : [],
      scratches: Array.isArray(parsed.scratches) ? parsed.scratches : [],
    };
  } catch {
    return { roots: [], scratches: [] };
  }
}

let state = load();

function persist() {
  try {
    fs.writeFileSync(JSON_LENS_STATE_FILE, JSON.stringify(state));
  } catch {
    // not fatal — persistence just won't survive a restart
  }
}

// ---- open root folders ----

export function listRoots() {
  return state.roots;
}

export function addRoot(dir) {
  if (!state.roots.includes(dir)) {
    state.roots = [...state.roots, dir];
    persist();
  }
  return state.roots;
}

export function removeRoot(dir) {
  state.roots = state.roots.filter((r) => r !== dir);
  persist();
  return state.roots;
}

// ---- scratches: app-managed JSON documents with no user-chosen disk path,
// persisted as real files under JSON_LENS_SCRATCHES_DIR so they survive a
// restart, but never shown in the filesystem tree the user browses ----

function scratchPath(id) {
  return path.join(JSON_LENS_SCRATCHES_DIR, `${id}.json`);
}

export function listScratches() {
  return state.scratches;
}

export function createScratch(name, content) {
  const id = `scr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  fs.mkdirSync(JSON_LENS_SCRATCHES_DIR, { recursive: true });
  fs.writeFileSync(scratchPath(id), content ?? '');
  const entry = { id, name, updatedAt: Date.now() };
  state.scratches = [...state.scratches, entry];
  persist();
  return entry;
}

export function readScratch(id) {
  return fs.readFileSync(scratchPath(id), 'utf8');
}

export function updateScratch(id, patch) {
  const idx = state.scratches.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  if (typeof patch.content === 'string') fs.writeFileSync(scratchPath(id), patch.content);
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
