import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-fields-sidebar-open';

function load() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

// Whether the Kibana-style "available fields" sidebar is open — persisted
// per-browser like the theme choice, defaulting to closed since most tabs
// (plain file tails) have nothing for it to show.
export function useFieldsSidebar() {
  const [open, setOpen] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [open]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return { sidebarOpen: open, toggleSidebar: toggle };
}
