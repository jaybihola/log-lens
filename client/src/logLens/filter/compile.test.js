import { describe, expect, it } from 'vitest';
import { compileQuery } from './compile.js';

describe('compileQuery', () => {
  it('returns a matcher, highlight terms, and no error for a valid query', () => {
    const { matcher, terms, error } = compileQuery('error');
    expect(error).toBeNull();
    expect(terms).toEqual(['error']);
    expect(matcher('an error occurred')).toBe(true);
    expect(matcher('all good')).toBe(false);
  });

  it('falls back to matching everything and surfaces the error on a malformed query', () => {
    const { matcher, terms, error } = compileQuery('(a');
    expect(typeof error).toBe('string');
    expect(terms).toEqual([]);
    // A typo in the query must never hide the buffer.
    expect(matcher('literally anything')).toBe(true);
  });

  it('respects caseSensitive', () => {
    const { matcher } = compileQuery('Error', { caseSensitive: true });
    expect(matcher('an Error occurred')).toBe(true);
    expect(matcher('an error occurred')).toBe(false);
  });

  it('ANDs a time range on top of the JQL match', () => {
    const { matcher } = compileQuery('error', { timeRange: { start: 1000, end: 2000 } });
    // ownTimestamp() reads a JSON entry's "Timestamp" field.
    const within = JSON.stringify({ Timestamp: new Date(1500).toISOString(), msg: 'error here' });
    const outside = JSON.stringify({ Timestamp: new Date(5000).toISOString(), msg: 'error here' });
    expect(matcher(within)).toBe(true);
    expect(matcher(outside)).toBe(false);
  });

  it('excludes a matching line with no resolvable timestamp when a time range is active', () => {
    const { matcher } = compileQuery('error', { timeRange: { start: 0, end: 999999999999 } });
    expect(matcher('an error occurred with no timestamp at all')).toBe(false);
  });

  it('still requires the JQL match before considering the time range', () => {
    const within = JSON.stringify({ Timestamp: new Date(1500).toISOString(), msg: 'all good' });
    const { matcher } = compileQuery('error', { timeRange: { start: 1000, end: 2000 } });
    expect(matcher(within)).toBe(false);
  });
});
