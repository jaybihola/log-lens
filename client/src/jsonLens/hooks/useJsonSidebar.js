import { useCallback, useEffect, useState } from 'react';

const OPEN_KEY = 'log-lens-json-sidebar-open';
const WIDTH_KEY = 'log-lens-json-sidebar-width';
const DEFAULT_WIDTH = 260;
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

// Same shape as Log Lens's useFieldsSidebar (open/width, both persisted
// per-browser) but its own hook rather than a shared one with a namespace
// param — kept separate deliberately so this file stays free to evolve for
// JSON Lens's actual needs (file tree + scratches, not index fields)
// without risking Log Lens's sidebar behavior. Defaults *open* (unlike Log
// Lens's fields sidebar) since a folder tree is the primary way to get
// anything into JSON Lens, not an optional extra.
export function useJsonSidebar() {
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
