import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-filter-mode';

function load() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'visual' ? 'visual' : 'text';
  } catch {
    return 'text';
  }
}

// Text (raw JQL) vs. visual (pill builder) mode for the toolbar's filter
// box — persisted per-browser like the theme choice. Both modes read/write
// the same tab filterQuery string; this only picks which editor renders it.
export function useFilterMode() {
  const [mode, setMode] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [mode]);

  const toggle = useCallback(() => setMode((prev) => (prev === 'text' ? 'visual' : 'text')), []);

  return { filterMode: mode, toggleFilterMode: toggle };
}
