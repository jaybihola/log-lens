import { useCallback, useState } from 'react';

const STORAGE_KEY = 'log-lens-time-range-usage';
// Shown until real usage data exists — the old fixed 4-button set
// (15m/1h/24h/7d), so the row isn't empty on a first run.
const DEFAULT_MINUTES = [15, 60, 60 * 24, 60 * 24 * 7];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e.minutes === 'number' && typeof e.count === 'number') : [];
  } catch {
    return [];
  }
}

function save(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* localStorage unavailable — display-only feature, not fatal */ }
}

// Which time ranges get picked, so the remote-query modal's always-visible
// shortcut buttons reflect actual habits instead of a fixed guess — same
// "adapt to what's really used" idea as useRecentFiles, but ranked by
// frequency (ties broken by recency) rather than a plain MRU stack, since a
// range picked constantly should outrank one clicked once yesterday.
// recordUse is only called from explicit picks (button/popover click), not
// the modal's own initial default, so just opening it doesn't skew the count.
export function useTimeRangeUsage(topN = 4) {
  const [usage, setUsage] = useState(load);

  const recordUse = useCallback((minutes) => {
    setUsage((prev) => {
      const next = prev.some((e) => e.minutes === minutes)
        ? prev.map((e) => (e.minutes === minutes ? { ...e, count: e.count + 1, lastUsed: Date.now() } : e))
        : [...prev, { minutes, count: 1, lastUsed: Date.now() }];
      save(next);
      return next;
    });
  }, []);

  const ranked = [...usage].sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed).map((e) => e.minutes);
  const top = ranked.slice(0, topN);
  for (const m of DEFAULT_MINUTES) {
    if (top.length >= topN) break;
    if (!top.includes(m)) top.push(m);
  }
  // Usage rank picks *which* ranges make the cut, but they always *display*
  // shortest-to-longest — otherwise a single one-off pick (e.g. a custom
  // "15 months" typed once) can land in the middle of the row and read as a
  // random jumble instead of the expected small-to-large progression.
  top.sort((a, b) => a - b);

  return { topRanges: top, recordUse };
}
