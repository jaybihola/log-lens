import { describe, expect, it } from 'vitest';
import { autoIntervalMs, computeTimeHistogram, NICE_INTERVALS_MS } from './timeHistogram.js';

describe('autoIntervalMs', () => {
  it('picks the smallest nice interval that keeps bucket count at or under target', () => {
    // span/target = 60000/60 = 1000 -> smallest nice interval >= 1000 is 1000
    expect(autoIntervalMs(60000, 60)).toBe(1000);
  });

  it('falls back to a multiple of the largest nice interval for very wide spans', () => {
    const largest = NICE_INTERVALS_MS[NICE_INTERVALS_MS.length - 1];
    const spanMs = largest * 100 * 60; // way beyond what any nice interval alone covers at 60 buckets
    const interval = autoIntervalMs(spanMs, 60);
    expect(interval % largest).toBe(0);
    expect(interval).toBeGreaterThanOrEqual(largest);
  });
});

describe('computeTimeHistogram', () => {
  it('returns an empty result with no buckets when nothing has a resolvable timestamp', () => {
    const result = computeTimeHistogram([{ text: 'no timestamp' }, { text: 'also none' }]);
    expect(result).toEqual({ buckets: [], min: null, max: null, timestamped: 0, untimestamped: 2, maxCount: 0, intervalMs: null });
  });

  it('counts untimestamped entries separately without dropping them silently', () => {
    const entries = [
      { text: '{"Timestamp":"2024-01-01T00:00:00Z","LogLevel":"Information"}' },
      { text: 'no timestamp here' },
    ];
    const result = computeTimeHistogram(entries);
    expect(result.timestamped).toBe(1);
    expect(result.untimestamped).toBe(1);
  });

  it('buckets entries by level within each time slice', () => {
    const entries = [
      { text: '{"Timestamp":"2024-01-01T00:00:00.000Z","LogLevel":"Error"}' },
      { text: '{"Timestamp":"2024-01-01T00:00:00.100Z","LogLevel":"Information"}' },
    ];
    const result = computeTimeHistogram(entries, { intervalMs: 60000 });
    // bucketCount is always ceil(span/interval) + 1 (one extra trailing
    // bucket) — both entries still land in the same (first) bucket since
    // the 100ms span is far smaller than the 60s interval.
    expect(result.buckets.length).toBeGreaterThanOrEqual(1);
    expect(result.buckets[0].count).toBe(2);
    expect(result.buckets[0].byLevel['lvl-error']).toBe(1);
    expect(result.buckets[0].byLevel['lvl-info']).toBe(1);
  });

  it('widens a too-fine manual interval rather than exceeding the max bucket count', () => {
    const entries = [
      { text: '{"Timestamp":"2024-01-01T00:00:00.000Z","LogLevel":"Information"}' },
      { text: '{"Timestamp":"2024-01-02T00:00:00.000Z","LogLevel":"Information"}' }, // 1 day span
    ];
    // Ask for a 1-second interval over a 1-day span -> would be 86400
    // buckets, must clamp to the 300-bucket cap.
    const result = computeTimeHistogram(entries, { intervalMs: 1000 });
    expect(result.buckets.length).toBeLessThanOrEqual(300);
  });

  it('reports the min/max span across timestamped entries only', () => {
    const entries = [
      { text: '{"Timestamp":"2024-01-01T00:00:10.000Z","LogLevel":"Information"}' },
      { text: '{"Timestamp":"2024-01-01T00:00:00.000Z","LogLevel":"Information"}' },
      { text: 'untimestamped' },
    ];
    const result = computeTimeHistogram(entries);
    expect(result.max - result.min).toBe(10000);
  });

  it('handles every entry sharing the exact same instant without dividing by zero', () => {
    const entries = [
      { text: '{"Timestamp":"2024-01-01T00:00:00.000Z","LogLevel":"Information"}' },
      { text: '{"Timestamp":"2024-01-01T00:00:00.000Z","LogLevel":"Information"}' },
    ];
    const result = computeTimeHistogram(entries);
    expect(result.buckets.length).toBeGreaterThan(0);
    expect(result.buckets.reduce((s, b) => s + b.count, 0)).toBe(2);
  });
});
