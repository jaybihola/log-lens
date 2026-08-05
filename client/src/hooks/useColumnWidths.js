import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-column-widths';
const DEFAULTS = { ts: 84, badge: 40, extra: {} };
const MIN_WIDTH = 40;
const MAX_WIDTH = 600;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      ts: Number.isFinite(raw.ts) ? raw.ts : DEFAULTS.ts,
      badge: Number.isFinite(raw.badge) ? raw.badge : DEFAULTS.badge,
      extra: raw.extra && typeof raw.extra === 'object' ? raw.extra : {},
    };
  } catch {
    return { ...DEFAULTS, extra: {} };
  }
}

function save(widths) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch { /* localStorage unavailable — display-only feature, not fatal */ }
}

// Column widths for the timestamp/level/extra-column cells shared between
// the header row and every log line — drag-resized from the header,
// persisted per-browser like the other display settings.
export function useColumnWidths() {
  const [widths, setWidths] = useState(load);

  useEffect(() => { save(widths); }, [widths]);

  const setColumnWidth = useCallback((column, width) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width)));
    setWidths((prev) => (column === 'ts' || column === 'badge'
      ? { ...prev, [column]: clamped }
      : { ...prev, extra: { ...prev.extra, [column]: clamped } }));
  }, []);

  const extraColumnWidth = useCallback((key) => widths.extra[key] || 120, [widths]);

  return { tsWidth: widths.ts, badgeWidth: widths.badge, extraColumnWidth, setColumnWidth };
}
