import { useCallback, useEffect, useState } from 'react';

const OPEN_KEY = 'log-lens-diff-sidebar-open';
const WIDTH_KEY = 'log-lens-diff-sidebar-width';
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 420;

function loadOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
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

// Same shape as useJsonSidebar.js, but defaults *closed* — unlike JSON Lens's
// folder tree, scratches aren't the primary way to get content into Diff
// Lens (pasting into the panes is), so the sidebar starts out of the way
// until there's actually something saved to show.
export function useDiffSidebar() {
  const [open, setOpen] = useState(loadOpen);
  const [width, setWidth] = useState(loadWidth);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? '1' : '0');
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [open]);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [width]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const resize = useCallback((next) => {
    setWidth(Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next))));
  }, []);

  return { sidebarOpen: open, toggleSidebar: toggle, sidebarWidth: width, resizeSidebar: resize };
}
