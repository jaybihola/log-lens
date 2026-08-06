import { useCallback, useEffect, useState } from 'react';

const OPEN_KEY = 'log-lens-fields-sidebar-open';
const WIDTH_KEY = 'log-lens-fields-sidebar-width';
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 160;
const MAX_WIDTH = 480;

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

// Whether the Kibana-style "available fields" sidebar is open, and how wide
// it is — both persisted per-browser like the theme choice. Defaults closed
// since most tabs (plain file tails) have nothing for it to show. Width is
// clamped rather than letting long field names stretch it — those truncate
// with an ellipsis instead (see FieldsSidebar); drag the resize handle to
// widen it when you want to read them in place.
export function useFieldsSidebar() {
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
