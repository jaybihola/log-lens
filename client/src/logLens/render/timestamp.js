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

// ownTimestamp's plain-text form is space-separated ("YYYY-MM-DD HH:mm:ss");
// Date.parse's handling of that exact shape isn't guaranteed across engines,
// so normalize to ISO's "T" separator before parsing. Shared by the time
// histogram's bucketing and per-line gap detection below, so both agree on
// what "the same instant" means.
export function parseTimestampMs(ts) {
  const iso = ts.includes(' ') && !ts.includes('T') ? ts.replace(' ', 'T') : ts;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

const MIN_GAP_MS = 3000; // never flag anything under 3s, regardless of typical spacing

// An "outlier" gap combines that fixed floor with a multiple of the visible
// set's own median gap, so a normally-bursty log's routine spacing doesn't
// get flagged just because one particular stretch was quieter, and a
// normally-quiet log's routine multi-second gaps don't get lost against a
// floor tuned for busier logs.
export function outlierGapThreshold(gapsMs) {
  if (!gapsMs.length) return Infinity;
  const sorted = [...gapsMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.max(MIN_GAP_MS, median * 6);
}

export function formatGap(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec < 10 ? totalSec.toFixed(1) : Math.round(totalSec)}s`;
  const totalMin = Math.floor(totalSec / 60);
  const remSec = Math.round(totalSec - totalMin * 60);
  if (totalMin < 60) return remSec ? `${totalMin}m ${remSec}s` : `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const remMin = totalMin - hours * 60;
  return remMin ? `${hours}h ${remMin}m` : `${hours}h`;
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
