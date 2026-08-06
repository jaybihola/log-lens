import { ownTimestamp, parseTimestampMs } from './timestamp.js';

const DEFAULT_BUCKET_COUNT = 60;

// Buckets a set of entries (whatever's currently filtered/on-screen — the
// caller decides that, this just counts) into `bucketCount` equal-width time
// slices for the density strip. Entries with no resolvable/parseable
// timestamp are excluded from bucketing but still counted (`untimestamped`)
// so the caller can say so rather than silently dropping them.
export function computeTimeHistogram(entries, bucketCount = DEFAULT_BUCKET_COUNT) {
  const times = [];
  let untimestamped = 0;
  for (const entry of entries) {
    const raw = ownTimestamp(entry.text);
    const ms = raw ? parseTimestampMs(raw) : null;
    if (ms === null) untimestamped += 1;
    else times.push(ms);
  }

  if (times.length === 0) {
    return { buckets: [], min: null, max: null, timestamped: 0, untimestamped, maxCount: 0 };
  }

  let min = times[0];
  let max = times[0];
  for (const t of times) {
    if (t < min) min = t;
    if (t > max) max = t;
  }

  const span = Math.max(max - min, 1); // avoid divide-by-zero when every entry shares one instant
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    start: min + (span * i) / bucketCount,
    end: min + (span * (i + 1)) / bucketCount,
    count: 0,
  }));

  for (const t of times) {
    const idx = Math.min(bucketCount - 1, Math.floor(((t - min) / span) * bucketCount));
    buckets[idx].count += 1;
  }

  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0);

  return { buckets, min, max, timestamped: times.length, untimestamped, maxCount };
}
