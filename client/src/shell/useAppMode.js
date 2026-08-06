import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-app-mode';

function load() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'json' ? 'json' : 'logs';
  } catch {
    return 'logs';
  }
}

// Which top-level tool is showing — the log viewer or the JSON formatter.
// Persisted per-browser like the theme choice, so reloading lands you back
// where you were.
export function useAppMode() {
  const [mode, setMode] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [mode]);

  const setModeSafe = useCallback((m) => setMode(m === 'json' ? 'json' : 'logs'), []);

  return { mode, setMode: setModeSafe };
}
