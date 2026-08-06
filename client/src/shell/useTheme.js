import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-theme';

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* localStorage unavailable — fall through to system preference */ }
  return systemPrefersDark() ? 'dark' : 'light';
}

// Explicit light/dark choice, persisted per-browser, defaulting to the OS
// preference on first run. Applied via a data-theme attribute on <html> so
// plain CSS (index.css) can key off it with no JS in the render path.
export function useTheme() {
  const [theme, setTheme] = useState(load);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme };
}
