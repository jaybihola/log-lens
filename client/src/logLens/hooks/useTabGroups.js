import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-tab-groups';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((g) => g && typeof g.name === 'string' && Array.isArray(g.paths))
      : [];
  } catch {
    return [];
  }
}

function save(groups) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch { /* localStorage unavailable — display-only feature, not fatal */ }
}

// Named, reusable sets of file paths ("checkout-service stack") that reopen
// together in one click — same localStorage-backed named-list shape as
// usePresets.js's saved JQL queries, just with an array of paths instead of
// a query string.
export function useTabGroups() {
  const [groups, setGroups] = useState(load);

  useEffect(() => { save(groups); }, [groups]);

  const saveGroup = useCallback((name, paths) => {
    const trimmed = name.trim();
    if (!trimmed || !paths.length) return;
    setGroups((prev) => [...prev.filter((g) => g.name !== trimmed), { name: trimmed, paths }]);
  }, []);

  const renameGroup = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setGroups((prev) => {
      const existing = prev.find((g) => g.name === oldName);
      if (!existing) return prev;
      return [...prev.filter((g) => g.name !== oldName && g.name !== trimmed), { ...existing, name: trimmed }];
    });
  }, []);

  const removeGroup = useCallback((name) => {
    setGroups((prev) => prev.filter((g) => g.name !== name));
  }, []);

  return { groups, saveGroup, renameGroup, removeGroup };
}
