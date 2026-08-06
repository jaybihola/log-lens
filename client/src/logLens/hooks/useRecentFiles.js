import { useCallback, useState } from 'react';

const STORAGE_KEY = 'log-lens-recent-files';
const MAX_RECENT = 8;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((p) => typeof p === 'string' && p) : [];
  } catch {
    return [];
  }
}

function save(paths) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  } catch { /* localStorage unavailable — display-only feature, not fatal */ }
}

// Last N opened file paths, most-recent first — a browser-side convenience
// (localStorage), same precedent as filter presets and extra columns.
export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState(load);

  const addRecent = useCallback((path) => {
    setRecentFiles((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, MAX_RECENT);
      save(next);
      return next;
    });
  }, []);

  const removeRecent = useCallback((path) => {
    setRecentFiles((prev) => {
      const next = prev.filter((p) => p !== path);
      save(next);
      return next;
    });
  }, []);

  return { recentFiles, addRecent, removeRecent };
}
