import fs from 'node:fs';
import { SETTINGS_FILE } from '../config.js';

// Which backend environments exist, which index/collection patterns they
// query, and which fields get their own autocompleting chip input are
// operator configuration, not hardcoded values — loaded from a git-ignored
// settings file (see log-lens.settings.example.json), with any edits made
// through the app's Settings modal persisted into the state file and taking
// precedence over the file on disk. Fold filters are defined per index (not
// per environment) since different indices in the same environment commonly
// have unrelated field schemas.
const DEFAULT_SETTINGS = { environments: [] };

function normalizeFoldFilters(raw) {
  return Array.isArray(raw)
    ? raw
      .filter((f) => f && typeof f.key === 'string' && f.key.trim() && typeof f.path === 'string' && f.path.trim())
      .map((f) => ({
        key: f.key.trim(),
        label: (typeof f.label === 'string' && f.label.trim()) || f.key.trim(),
        path: f.path.trim(),
        presetValues: Array.isArray(f.presetValues)
          ? f.presetValues.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())
          : [],
      }))
    : [];
}

// Manual per-field type overrides (fieldName -> ES type string), for when the
// mapping's detected type isn't what you want (or a field is ambiguous,
// e.g. mapped "text" but really numeric-ish for a user's purposes).
function normalizeFieldTypeOverrides(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key === 'string' && key.trim() && typeof value === 'string' && value.trim()) {
      out[key.trim()] = value.trim();
    }
  }
  return out;
}

// Tolerates a bare string ("logs-app-*") as shorthand for an index with no
// fold filters configured yet — convenient when first wiring up an
// environment, not a legacy shape to migrate away from.
function normalizeIndexEntry(idx) {
  if (typeof idx === 'string') {
    return { pattern: idx.trim(), foldFilters: [], fieldTypeOverrides: {} };
  }
  if (!idx || typeof idx !== 'object') return null;
  const pattern = (typeof idx.pattern === 'string' ? idx.pattern : idx.index || '').trim();
  if (!pattern) return null;
  return {
    pattern,
    foldFilters: normalizeFoldFilters(idx.foldFilters),
    fieldTypeOverrides: normalizeFieldTypeOverrides(idx.fieldTypeOverrides),
  };
}

function normalizeEnvironment(e) {
  const rawIndices = Array.isArray(e.indices) ? e.indices : [];
  return {
    name: e.name.trim(),
    url: e.url.trim(),
    credentialId: typeof e.credentialId === 'string' && e.credentialId.trim() ? e.credentialId.trim() : null,
    indices: rawIndices.map(normalizeIndexEntry).filter(Boolean),
  };
}

export function normalizeSettings(raw) {
  const parsed = raw || {};
  return {
    environments: Array.isArray(parsed.environments)
      ? parsed.environments
        .filter((e) => e && typeof e.name === 'string' && e.name.trim() && typeof e.url === 'string' && e.url.trim())
        .map(normalizeEnvironment)
      : [],
  };
}

export function loadSettingsFile() {
  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// Mutable module-level state — overridden by a UI-saved copy in the state
// file, if present (see state.js), and reassigned wholesale on every
// successful POST /api/settings.
let settings = loadSettingsFile();

export function getSettings() {
  return settings;
}

export function setSettings(next) {
  settings = normalizeSettings(next);
  return settings;
}

export function getEnvironment(name) {
  return settings.environments.find((e) => e.name === name) || null;
}

export function environmentUrl(name) {
  const env = getEnvironment(name);
  return env ? env.url : null;
}

export function getIndexConfig(environmentName, indexPattern) {
  const env = getEnvironment(environmentName);
  return env ? env.indices.find((i) => i.pattern === indexPattern) || null : null;
}

export function foldFilterByKey(environmentName, indexPattern, key) {
  const idx = getIndexConfig(environmentName, indexPattern);
  return idx ? idx.foldFilters.find((f) => f.key === key) || null : null;
}

export function fieldTypeOverrides(environmentName, indexPattern) {
  const idx = getIndexConfig(environmentName, indexPattern);
  return idx ? idx.fieldTypeOverrides : {};
}
