import { describe, expect, it } from 'vitest';
import { QUICK_RANGES, minutesToLabel, shortMinutesLabel } from './timeRanges.js';

describe('minutesToLabel', () => {
  it('returns null for zero/falsy minutes', () => {
    expect(minutesToLabel(0)).toBeNull();
    expect(minutesToLabel(null)).toBeNull();
  });

  it('uses the exact QUICK_RANGES label when the minute count matches one', () => {
    for (const range of QUICK_RANGES) {
      expect(minutesToLabel(range.minutes)).toBe(range.label);
    }
  });

  it('formats an even multiple of a day not in QUICK_RANGES as "Last N days"', () => {
    expect(minutesToLabel(60 * 24 * 3)).toBe('Last 3 days');
  });

  it('formats an even multiple of an hour as "Last N hours"', () => {
    expect(minutesToLabel(60 * 5)).toBe('Last 5 hours');
  });

  it('singularizes "1 hour"/"1 day"/"1 minute"', () => {
    expect(minutesToLabel(60)).toBe('Last 1 hour'); // also a QUICK_RANGES entry
    expect(minutesToLabel(1)).toBe('Last 1 minute');
  });

  it('falls back to raw minutes when nothing divides evenly', () => {
    expect(minutesToLabel(37)).toBe('Last 37 minutes');
  });
});

describe('shortMinutesLabel', () => {
  it('returns an empty string for zero/falsy minutes', () => {
    expect(shortMinutesLabel(0)).toBe('');
  });

  it('prefers the coarsest evenly-dividing unit: years > days > hours > minutes', () => {
    expect(shortMinutesLabel(60 * 24 * 365)).toBe('1y');
    expect(shortMinutesLabel(60 * 24 * 2)).toBe('2d');
    expect(shortMinutesLabel(60 * 3)).toBe('3h');
    expect(shortMinutesLabel(45)).toBe('45m');
  });
});
