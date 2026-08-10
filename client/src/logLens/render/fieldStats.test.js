import { describe, expect, it } from 'vitest';
import { computeFieldStats } from './fieldStats.js';

describe('computeFieldStats', () => {
  it('counts value occurrences and sorts buckets by descending count', () => {
    const buffer = [
      { text: '{"level":"info"}' },
      { text: '{"level":"error"}' },
      { text: '{"level":"info"}' },
      { text: '{"level":"info"}' },
    ];
    const stats = computeFieldStats(buffer, 'level');
    expect(stats.field).toBe('level');
    expect(stats.total).toBe(4);
    expect(stats.buckets).toEqual([{ value: 'info', count: 3 }, { value: 'error', count: 1 }]);
  });

  it('excludes entries where the field is absent, but does count total only over present ones', () => {
    const buffer = [{ text: '{"level":"info"}' }, { text: '{"other":1}' }];
    const stats = computeFieldStats(buffer, 'level');
    expect(stats.total).toBe(1);
    expect(stats.buckets).toEqual([{ value: 'info', count: 1 }]);
  });

  it('returns an empty result for an empty buffer', () => {
    expect(computeFieldStats([], 'level')).toEqual({ field: 'level', total: 0, buckets: [] });
  });

  it('counts a present-but-null value as its own bucket with an empty-string value', () => {
    const buffer = [{ text: '{"level":null}' }, { text: '{"level":null}' }];
    const stats = computeFieldStats(buffer, 'level');
    expect(stats.buckets).toEqual([{ value: '', count: 2 }]);
  });
});
