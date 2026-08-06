import { tryParseJsonObject } from './jsonPaths.js';

const LEADING_TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?)/;

// Pulls a display-friendly time out of a JSON entry's "Timestamp" field (or
// a leading ISO-ish timestamp for plain-text entries) so it can be shown in
// its own column instead of buried inline in the message.
export function ownTimestamp(text) {
  const obj = tryParseJsonObject(text);
  if (obj && typeof obj.Timestamp === 'string') return obj.Timestamp;
  if (obj && typeof obj['@timestamp'] === 'string') return obj['@timestamp']; // ES hits (api tabs)
  const m = LEADING_TIMESTAMP_RE.exec(text.trim());
  return m ? m[1] : null;
}

// A console-format entry has no timestamp of its own — borrow its paired
// JSON entry's timestamp so both halves of a pair show the same time.
export function computeTimestamps(lines, pairs) {
  const map = new Map();
  for (const entry of lines) {
    const ts = ownTimestamp(entry.text);
    if (ts) map.set(entry.seq, ts);
  }
  for (const entry of lines) {
    if (map.has(entry.seq)) continue;
    const pairedSeq = pairs.get(entry.seq);
    if (pairedSeq && map.has(pairedSeq)) map.set(entry.seq, map.get(pairedSeq));
  }
  return map;
}

export function formatTimeShort(iso) {
  const m = /(\d{2}:\d{2}:\d{2})(?:\.(\d+))?/.exec(iso);
  if (!m) return iso;
  return m[1] + (m[2] ? `.${m[2].slice(0, 3)}` : '');
}

// A bare number jumps by seq (exact match, else nearest); anything else is
// matched as a prefix against each entry's short-formatted timestamp
// (e.g. "14:32" matches the first entry at or after that time).
export function resolveJumpTarget(buffer, query) {
  const trimmed = query.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const target = Number(trimmed);
    let best = null;
    for (const entry of buffer) {
      if (entry.seq === target) return entry.seq;
      if (best === null || Math.abs(entry.seq - target) < Math.abs(best - target)) best = entry.seq;
    }
    return best;
  }
  for (const entry of buffer) {
    const ts = ownTimestamp(entry.text);
    if (ts && formatTimeShort(ts).startsWith(trimmed)) return entry.seq;
  }
  return null;
}
