import { describe, expect, it } from 'vitest';
import {
  ownTimestamp, computeTimestamps, parseTimestampMs, outlierGapThreshold, formatGap, formatTimeShort, resolveJumpTarget,
} from './timestamp.js';

describe('ownTimestamp', () => {
  it('reads a JSON entry\'s Timestamp field', () => {
    expect(ownTimestamp('{"Timestamp":"2024-01-01T00:00:00Z","a":1}')).toBe('2024-01-01T00:00:00Z');
  });

  it('reads an ES-style @timestamp field', () => {
    expect(ownTimestamp('{"@timestamp":"2024-01-01T00:00:00Z"}')).toBe('2024-01-01T00:00:00Z');
  });

  it('prefers Timestamp over @timestamp when both are present', () => {
    expect(ownTimestamp('{"Timestamp":"A","@timestamp":"B"}')).toBe('A');
  });

  it('reads a leading ISO-ish timestamp from plain text', () => {
    expect(ownTimestamp('2024-01-01T12:30:45.123 something happened')).toBe('2024-01-01T12:30:45.123');
  });

  it('reads a leading space-separated timestamp from plain text', () => {
    expect(ownTimestamp('2024-01-01 12:30:45 something happened')).toBe('2024-01-01 12:30:45');
  });

  it('returns null when there is no JSON Timestamp and no leading timestamp', () => {
    expect(ownTimestamp('no timestamp here')).toBeNull();
    expect(ownTimestamp('{"a":1}')).toBeNull();
  });
});

describe('computeTimestamps', () => {
  it('maps each entry with its own resolvable timestamp', () => {
    const lines = [{ seq: 1, text: '{"Timestamp":"A"}' }, { seq: 2, text: '{"Timestamp":"B"}' }];
    const map = computeTimestamps(lines, new Map());
    expect(map.get(1)).toBe('A');
    expect(map.get(2)).toBe('B');
  });

  it('borrows a paired entry\'s timestamp when its own text has none', () => {
    const lines = [
      { seq: 1, text: 'plain console line, no timestamp' },
      { seq: 2, text: '{"Timestamp":"paired-ts"}' },
    ];
    const pairs = new Map([[1, 2]]);
    const map = computeTimestamps(lines, pairs);
    expect(map.get(1)).toBe('paired-ts');
    expect(map.get(2)).toBe('paired-ts');
  });

  it('leaves an entry unmapped when it has no timestamp and no resolvable pair', () => {
    const lines = [{ seq: 1, text: 'no timestamp, no pair' }];
    const map = computeTimestamps(lines, new Map());
    expect(map.has(1)).toBe(false);
  });
});

describe('parseTimestampMs', () => {
  it('parses an ISO timestamp', () => {
    expect(parseTimestampMs('2024-01-01T00:00:00Z')).toBe(Date.parse('2024-01-01T00:00:00Z'));
  });

  it('normalizes a space-separated timestamp to ISO before parsing', () => {
    expect(parseTimestampMs('2024-01-01 00:00:00')).toBe(Date.parse('2024-01-01T00:00:00'));
  });

  it('returns null for an unparseable timestamp', () => {
    expect(parseTimestampMs('not a date')).toBeNull();
  });
});

describe('outlierGapThreshold', () => {
  it('returns Infinity for an empty gap list', () => {
    expect(outlierGapThreshold([])).toBe(Infinity);
  });

  it('never flags anything under the 3s floor even with a tiny median', () => {
    expect(outlierGapThreshold([100, 100, 100])).toBe(3000);
  });

  it('scales with 6x the median once that exceeds the floor', () => {
    // median of [1000,2000,3000] is 2000 -> 6x = 12000, above the 3000 floor
    expect(outlierGapThreshold([1000, 2000, 3000])).toBe(12000);
  });
});

describe('formatGap', () => {
  it('formats sub-second gaps in ms', () => {
    expect(formatGap(500)).toBe('500ms');
  });

  it('formats sub-10s gaps with one decimal', () => {
    expect(formatGap(4500)).toBe('4.5s');
  });

  it('formats 10s-59s gaps rounded to whole seconds', () => {
    expect(formatGap(45000)).toBe('45s');
  });

  it('formats minute-scale gaps as Xm Ys, omitting Ys when zero', () => {
    expect(formatGap(90000)).toBe('1m 30s');
    expect(formatGap(60000)).toBe('1m');
  });

  it('formats hour-scale gaps as Xh Ym, omitting Ym when zero', () => {
    expect(formatGap(3600000)).toBe('1h');
    expect(formatGap(3660000)).toBe('1h 1m');
  });
});

describe('formatTimeShort', () => {
  it('extracts just HH:MM:SS, truncating fractional seconds to 3 digits', () => {
    expect(formatTimeShort('2024-01-01T12:30:45.123456Z')).toBe('12:30:45.123');
  });

  it('extracts HH:MM:SS with no fraction when there is none', () => {
    expect(formatTimeShort('2024-01-01T12:30:45Z')).toBe('12:30:45');
  });

  it('returns the input unchanged when no time pattern is found', () => {
    expect(formatTimeShort('not a timestamp')).toBe('not a timestamp');
  });
});

describe('resolveJumpTarget', () => {
  const buffer = [
    { seq: 1, text: '{"Timestamp":"2024-01-01T10:00:00Z"}' },
    { seq: 5, text: '{"Timestamp":"2024-01-01T10:05:00Z"}' },
    { seq: 9, text: '{"Timestamp":"2024-01-01T10:09:00Z"}' },
  ];

  it('returns null for a blank query', () => {
    expect(resolveJumpTarget(buffer, '  ')).toBeNull();
  });

  it('jumps to an exact seq match when the query is a bare number', () => {
    expect(resolveJumpTarget(buffer, '5')).toBe(5);
  });

  it('jumps to the nearest seq when there is no exact number match', () => {
    expect(resolveJumpTarget(buffer, '4')).toBe(5); // closer to 5 than to 1
  });

  it('jumps to the first entry whose short time starts with the query', () => {
    expect(resolveJumpTarget(buffer, '10:05')).toBe(5);
  });

  it('returns null when no entry\'s time matches the query prefix', () => {
    expect(resolveJumpTarget(buffer, '23:59')).toBeNull();
  });
});
