import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-app-mode';

const MODES = ['logs', 'json', 'mock'];

function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(stored) ? stored : 'logs';
  } catch {
    return 'logs';
  }
}

// Which top-level tool is showing — log viewer, JSON formatter, or Mock
// View. Persisted per-browser like the theme choice, so reloading lands you
// back where you were.
export function useAppMode() {
  const [mode, setMode] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [mode]);

  const setModeSafe = useCallback((m) => setMode(MODES.includes(m) ? m : 'logs'), []);

  return { mode, setMode: setModeSafe };
}
