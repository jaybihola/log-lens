import { resolveJsonObject } from './jsonPaths.js';

// Kibana-style field flattening: nested objects/arrays become dot/bracket-path
// leaf rows (e.g. "Properties.CorrelationId") instead of one opaque JSON blob.
function flattenForTable(value, prefix, out) {
  out = out || [];
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => flattenForTable(v, `${prefix}[${i}]`, out));
  } else if (typeof value === 'object') {
    Object.keys(value).forEach((k) => flattenForTable(value[k], prefix ? `${prefix}.${k}` : k, out));
  } else {
    out.push({ key: prefix, value: String(value) });
  }
  return out;
}

// Top-level keys already surfaced as their own mandatory row (Time/Level) —
// excluded from the flattened field list so they don't show up twice.
const MANDATORY_JSON_KEYS = new Set(['Timestamp', 'LogLevel']);

// Returns [{ label, value, keyPath }] — keyPath is null for rows that aren't
// a real JSON field (metadata, or the plain-string "message" fallback) and
// so can't be toggled on/off as a column.
export function buildFieldRows(entry, { pairedSeq, timeLabel, levelLabel }) {
  const rows = [
    { label: '#', value: String(entry.seq), keyPath: null },
    { label: 'Time', value: timeLabel || '', keyPath: null },
    { label: 'Level', value: levelLabel, keyPath: null },
  ];
  if (pairedSeq) rows.push({ label: 'Pair', value: `#${pairedSeq}`, keyPath: null });

  const obj = resolveJsonObject(entry.text);
  if (obj && typeof obj === 'object') {
    const fields = flattenForTable(obj, '').filter((f) => !MANDATORY_JSON_KEYS.has(f.key));
    fields.forEach((f) => rows.push({ label: f.key, value: f.value, keyPath: f.key }));
  } else {
    rows.push({ label: 'message', value: entry.text, keyPath: null });
  }
  return rows;
}
