import { ownTimestamp, parseTimestampMs } from './timestamp.js';
import { levelClass } from './highlight.js';

const DEFAULT_BUCKET_COUNT = 60;

// Buckets a set of entries (whatever's currently filtered/on-screen — the
// caller decides that, this just counts) into `bucketCount` equal-width time
// slices for the density strip, each slice broken down by log level.
// Entries with no resolvable/parseable timestamp are excluded from bucketing
// but still counted (`untimestamped`) so the caller can say so rather than
// silently dropping them.
export function computeTimeHistogram(entries, bucketCount = DEFAULT_BUCKET_COUNT) {
  const items = [];
  let untimestamped = 0;
  for (const entry of entries) {
    const raw = ownTimestamp(entry.text);
    const ms = raw ? parseTimestampMs(raw) : null;
    if (ms === null) { untimestamped += 1; continue; }
    items.push({ ms, level: levelClass(entry.text) });
  }

  if (items.length === 0) {
    return { buckets: [], min: null, max: null, timestamped: 0, untimestamped, maxCount: 0 };
  }

  let min = items[0].ms;
  let max = items[0].ms;
  for (const it of items) {
    if (it.ms < min) min = it.ms;
    if (it.ms > max) max = it.ms;
  }

  const span = Math.max(max - min, 1); // avoid divide-by-zero when every entry shares one instant
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    start: min + (span * i) / bucketCount,
    end: min + (span * (i + 1)) / bucketCount,
    count: 0,
    byLevel: { 'lvl-error': 0, 'lvl-warn': 0, 'lvl-info': 0, 'lvl-debug': 0 },
  }));

  for (const it of items) {
    const idx = Math.min(bucketCount - 1, Math.floor(((it.ms - min) / span) * bucketCount));
    buckets[idx].count += 1;
    buckets[idx].byLevel[it.level] = (buckets[idx].byLevel[it.level] || 0) + 1;
  }

  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0);

  return { buckets, min, max, timestamped: items.length, untimestamped, maxCount };
}
