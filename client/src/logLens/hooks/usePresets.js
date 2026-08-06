import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-filter-presets';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((p) => p && typeof p.name === 'string' && typeof p.query === 'string')
      : [];
  } catch {
    return [];
  }
}

function save(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch { /* localStorage unavailable — display-only feature, not fatal */ }
}

// Named, reusable JQL filter queries — a browser-side display preference
// (localStorage), not shared server state.
export function usePresets() {
  const [presets, setPresets] = useState(load);

  useEffect(() => { save(presets); }, [presets]);

  const savePreset = useCallback((name, query) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPresets((prev) => [...prev.filter((p) => p.name !== trimmed), { name: trimmed, query }]);
  }, []);

  const removePreset = useCallback((name) => {
    setPresets((prev) => prev.filter((p) => p.name !== name));
  }, []);

  return { presets, savePreset, removePreset };
}
