import { useCallback, useEffect, useState } from 'react';

const SAVED_KEY = 'log-lens-remote-query-presets';
const RECENT_KEY = 'log-lens-remote-query-recent';
const MAX_RECENT = 8;

function isValidConfig(c) {
  return c && typeof c === 'object' && typeof c.environment === 'string' && typeof c.index === 'string';
}

function load(key, validate) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw.filter(validate) : [];
  } catch {
    return [];
  }
}

function save(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch { /* localStorage unavailable — display-only feature, not fatal */ }
}

// Saved (named, user-managed) and recent (auto-tracked, capped) configs for
// the "new remote query" modal — browser-side convenience, same precedent as
// usePresets/useRecentFiles. Each entry snapshots enough of the form to
// fully repopulate it: environment, index, kql, foldValues, and
// rangeMinutes (the last quick-range button picked — re-applied relative to
// "now" on load rather than replaying stale absolute timestamps; null if
// the user last edited the date inputs directly).
export function useRemoteQueryPresets() {
  const [saved, setSaved] = useState(() => load(SAVED_KEY, isValidConfig));
  const [recent, setRecent] = useState(() => load(RECENT_KEY, isValidConfig));

  useEffect(() => { save(SAVED_KEY, saved); }, [saved]);
  useEffect(() => { save(RECENT_KEY, recent); }, [recent]);

  const saveQuery = useCallback((name, config) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaved((prev) => [...prev.filter((p) => p.name !== trimmed), { ...config, name: trimmed }]);
  }, []);

  const removeSaved = useCallback((name) => {
    setSaved((prev) => prev.filter((p) => p.name !== name));
  }, []);

  // Dedupes on the fields that actually change the query (not rangeMinutes,
  // so re-running "last 1h" over and over doesn't pile up near-identical
  // entries) and always moves the match back to the front.
  const pushRecent = useCallback((config) => {
    const dedupeKey = (c) => JSON.stringify({ environment: c.environment, index: c.index, kql: c.kql, foldValues: c.foldValues });
    const key = dedupeKey(config);
    setRecent((prev) => [config, ...prev.filter((p) => dedupeKey(p) !== key)].slice(0, MAX_RECENT));
  }, []);

  const removeRecent = useCallback((index) => {
    setRecent((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return { saved, recent, saveQuery, removeSaved, pushRecent, removeRecent };
}
