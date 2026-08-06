import { ownTimestamp, parseTimestampMs } from './timestamp.js';
import { levelClass } from './highlight.js';

const DEFAULT_TARGET_BUCKETS = 60; // Kibana's own default-ish density
const MAX_BUCKETS = 300; // hard cap so a fine manual interval over a huge span can't blow up the DOM/layout

// "Nice" interval choices, seconds-through-a-day — both what auto-interval
// snaps to and what the manual override dropdown offers.
export const NICE_INTERVALS_MS = [
  1000, 5000, 10000, 30000,
  60000, 5 * 60000, 15 * 60000, 30 * 60000,
  3600000, 3 * 3600000, 12 * 3600000, 86400000,
];

// Smallest "nice" interval that keeps the bucket count at or under the
// target — mirrors Kibana Discover's own auto-bucketing default. Falls back
// to a multiple of the largest nice interval for spans too wide for even
// the coarsest single nice step.
export function autoIntervalMs(spanMs, targetBuckets = DEFAULT_TARGET_BUCKETS) {
  const raw = spanMs / targetBuckets;
  for (const ms of NICE_INTERVALS_MS) {
    if (ms >= raw) return ms;
  }
  const largest = NICE_INTERVALS_MS[NICE_INTERVALS_MS.length - 1];
  return largest * Math.ceil(raw / largest);
}

// Buckets a set of entries (whatever's currently filtered/on-screen — the
// caller decides that, this just counts) into time slices for the density
// strip, each slice broken down by log level. Entries with no
// resolvable/parseable timestamp are excluded from bucketing but still
// counted (`untimestamped`) so the caller can say so rather than silently
// dropping them.
//
// `intervalMs`: fixed bucket width in ms. Omit/null for auto (span-based,
// snapped to a "nice" interval) — the interval actually used either way is
// returned as `intervalMs` so the caller (the interval dropdown) can show
// what "Auto" resolved to.
export function computeTimeHistogram(entries, { intervalMs } = {}) {
  const items = [];
  let untimestamped = 0;
  for (const entry of entries) {
    const raw = ownTimestamp(entry.text);
    const ms = raw ? parseTimestampMs(raw) : null;
    if (ms === null) { untimestamped += 1; continue; }
    items.push({ ms, level: levelClass(entry.text) });
  }

  if (items.length === 0) {
    return { buckets: [], min: null, max: null, timestamped: 0, untimestamped, maxCount: 0, intervalMs: null };
  }

  let min = items[0].ms;
  let max = items[0].ms;
  for (const it of items) {
    if (it.ms < min) min = it.ms;
    if (it.ms > max) max = it.ms;
  }

  const span = Math.max(max - min, 1); // avoid divide-by-zero when every entry shares one instant
  // Clamp: respect a manual interval when the span allows it, but never let
  // it produce more than MAX_BUCKETS — widening the interval rather than
  // silently dropping/merging data outside a fixed bucket count.
  const requested = intervalMs || autoIntervalMs(span);
  const effectiveInterval = Math.max(requested, span / MAX_BUCKETS);
  const bucketCount = Math.max(1, Math.min(MAX_BUCKETS, Math.ceil(span / effectiveInterval) + 1));

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    start: min + effectiveInterval * i,
    end: min + effectiveInterval * (i + 1),
    count: 0,
    byLevel: { 'lvl-error': 0, 'lvl-warn': 0, 'lvl-info': 0, 'lvl-debug': 0 },
  }));

  for (const it of items) {
    const idx = Math.min(bucketCount - 1, Math.floor((it.ms - min) / effectiveInterval));
    buckets[idx].count += 1;
    buckets[idx].byLevel[it.level] = (buckets[idx].byLevel[it.level] || 0) + 1;
  }

  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0);

  return { buckets, min, max, timestamped: items.length, untimestamped, maxCount, intervalMs: effectiveInterval };
}
