import { useCallback, useEffect, useState } from 'react';

const OPEN_KEY = 'log-lens-mock-sidebar-open';
const WIDTH_KEY = 'log-lens-mock-sidebar-width';
const DEFAULT_WIDTH = 250;
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;

function loadOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

function loadWidth() {
  try {
    const raw = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(raw) ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, raw)) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

// Same shape as JSON Lens's useJsonSidebar.js (open/width, persisted
// per-browser, defaults open) — its own hook rather than a shared one,
// same reasoning: free to evolve for Mock View's own sidebar without
// risking the other tools'.
export function useMockSidebar() {
  const [open, setOpen] = useState(loadOpen);
  const [width, setWidth] = useState(loadWidth);

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* not fatal */ }
  }, [open]);

  useEffect(() => {
    try { localStorage.setItem(WIDTH_KEY, String(width)); } catch { /* not fatal */ }
  }, [width]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const resize = useCallback((next) => {
    setWidth(Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next))));
  }, []);

  return { sidebarOpen: open, toggleSidebar: toggle, sidebarWidth: width, resizeSidebar: resize };
}
