// Kibana-style "commonly used" durations for the remote-query modal's time
// range picker — a much wider spread than the old 4-button row (15m/1h/24h/
// 7d), covering the same units Kibana's own quick-select list ships with by
// default. Kept separate from RemoteQueryTimeRangeMenu.jsx (a component
// file) so Fast Refresh stays happy — same precedent as filter/
// visualClauses.js for VisualFilterBuilder/FilterClauseEditor.
export const QUICK_RANGES = [
  { label: 'Last 15 minutes', minutes: 15 },
  { label: 'Last 30 minutes', minutes: 30 },
  { label: 'Last 1 hour', minutes: 60 },
  { label: 'Last 4 hours', minutes: 60 * 4 },
  { label: 'Last 12 hours', minutes: 60 * 12 },
  { label: 'Last 24 hours', minutes: 60 * 24 },
  { label: 'Last 2 days', minutes: 60 * 24 * 2 },
  { label: 'Last 7 days', minutes: 60 * 24 * 7 },
  { label: 'Last 30 days', minutes: 60 * 24 * 30 },
  { label: 'Last 90 days', minutes: 60 * 24 * 90 },
  { label: 'Last 1 year', minutes: 60 * 24 * 365 },
];

export const UNIT_MINUTES = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
  weeks: 60 * 24 * 7,
  months: 60 * 24 * 30,
};

// Short pill labels for the custom quick-select's unit toggle — a compact
// segmented group (reuses .filter-combine-toggle's look), not a full
// Dropdown; single letters keep each pill narrow.
export const UNITS = [
  { id: 'minutes', label: 'm' },
  { id: 'hours', label: 'h' },
  { id: 'days', label: 'd' },
  { id: 'weeks', label: 'w' },
  { id: 'months', label: 'mo' },
];

// Turns an arbitrary minute count back into a readable "Last N unit" label
// for the trigger button — exact for anything QUICK_RANGES already names,
// otherwise picks the coarsest unit that divides evenly (so "Apply"-ing 3
// days out of the custom picker reads as "Last 3 days", not "Last 4320
// minutes").
export function minutesToLabel(minutes) {
  if (!minutes) return null;
  const known = QUICK_RANGES.find((r) => r.minutes === minutes);
  if (known) return known.label;
  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return `Last ${days} day${days === 1 ? '' : 's'}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `Last ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `Last ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

// Compact form for the always-visible quick-range buttons ("1h", "24h",
// "7d") — minutesToLabel's "Last N unit" reads better in the dropdown list
// but is too wide for a button that needs to stay small.
export function shortMinutesLabel(minutes) {
  if (!minutes) return '';
  if (minutes % (60 * 24 * 365) === 0) return `${minutes / (60 * 24 * 365)}y`;
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}
