import { jsonPathValue } from './jsonPaths.js';

// Value distribution for a field, computed purely from what's already
// loaded into the tab (its buffer) — not a fresh query against the backend.
// This is deliberate: a remote-query tab's buffer is already the bounded
// result set the user chose to fetch, so this stays cheap regardless of how
// large the underlying index/cluster is, and it always matches what's
// actually on screen rather than drifting from it (see: the popover showing
// values the log view's own date range had already excluded).
export function computeFieldStats(buffer, field) {
  const counts = new Map();
  let total = 0;
  for (const entry of buffer) {
    const { present, value } = jsonPathValue(entry.text, field);
    if (!present) continue;
    total += 1;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const buckets = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
  return { field, total, buckets };
}
