import { describe, expect, it } from 'vitest';
import { buildFieldRows } from './fieldTable.js';

describe('buildFieldRows', () => {
  it('always includes #, Time, Level as the first rows with no keyPath', () => {
    const rows = buildFieldRows({ seq: 3, text: 'plain text' }, { timeLabel: '12:00:00', levelLabel: 'INFO' });
    expect(rows.slice(0, 3)).toEqual([
      { label: '#', value: '3', keyPath: null },
      { label: 'Time', value: '12:00:00', keyPath: null },
      { label: 'Level', value: 'INFO', keyPath: null },
    ]);
  });

  it('includes a Pair row only when pairedSeq is given', () => {
    const withPair = buildFieldRows({ seq: 1, text: 'x' }, { pairedSeq: 7, timeLabel: '', levelLabel: 'INFO' });
    expect(withPair.some((r) => r.label === 'Pair' && r.value === '#7')).toBe(true);

    const withoutPair = buildFieldRows({ seq: 1, text: 'x' }, { timeLabel: '', levelLabel: 'INFO' });
    expect(withoutPair.some((r) => r.label === 'Pair')).toBe(false);
  });

  it('falls back to a single "message" row for non-JSON text', () => {
    const rows = buildFieldRows({ seq: 1, text: 'plain console line' }, { timeLabel: '', levelLabel: 'INFO' });
    expect(rows.find((r) => r.label === 'message')).toEqual({ label: 'message', value: 'plain console line', keyPath: null });
  });

  it('flattens a JSON entry into dot-path field rows with a real keyPath', () => {
    const entry = { seq: 1, text: '{"a":{"b":1},"c":2}' };
    const rows = buildFieldRows(entry, { timeLabel: '', levelLabel: 'INFO' });
    expect(rows.find((r) => r.keyPath === 'a.b')).toEqual({ label: 'a.b', value: '1', keyPath: 'a.b' });
    expect(rows.find((r) => r.keyPath === 'c')).toEqual({ label: 'c', value: '2', keyPath: 'c' });
  });

  it('excludes mandatory JSON keys (Timestamp/LogLevel) from the flattened field list', () => {
    const entry = { seq: 1, text: '{"Timestamp":"x","LogLevel":"Info","a":1}' };
    const rows = buildFieldRows(entry, { timeLabel: '', levelLabel: 'INFO' });
    expect(rows.some((r) => r.keyPath === 'Timestamp')).toBe(false);
    expect(rows.some((r) => r.keyPath === 'LogLevel')).toBe(false);
    expect(rows.some((r) => r.keyPath === 'a')).toBe(true);
  });

  it('flattens array items with bracket-index keyPaths', () => {
    const entry = { seq: 1, text: '{"Tags":["x","y"]}' };
    const rows = buildFieldRows(entry, { timeLabel: '', levelLabel: 'INFO' });
    expect(rows.find((r) => r.keyPath === 'Tags[0]').value).toBe('x');
    expect(rows.find((r) => r.keyPath === 'Tags[1]').value).toBe('y');
  });
});
