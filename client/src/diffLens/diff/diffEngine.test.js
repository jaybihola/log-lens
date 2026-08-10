import { describe, expect, it } from 'vitest';
import { diff as preciseDiff } from '@codemirror/merge';
import { buildDiffOverride } from './diffEngine.js';

const NO_OPTIONS = { ignoreWhitespace: false, ignoreCase: false, ignoreBlankLines: false, ignoreLineEndings: false };

function toRanges(changes) {
  return changes.map((c) => [c.fromA, c.toA, c.fromB, c.toB]);
}

describe('buildDiffOverride', () => {
  it('returns null when no ignore-option is active, so callers use the library default', () => {
    expect(buildDiffOverride(NO_OPTIONS)).toBeNull();
    expect(buildDiffOverride({})).toBeNull();
  });

  it('returns a callable override when any ignore-option is active', () => {
    const override = buildDiffOverride({ ...NO_OPTIONS, ignoreCase: true });
    expect(typeof override).toBe('function');
  });

  it('ignoreCase treats differently-cased lines as unchanged', () => {
    const override = buildDiffOverride({ ...NO_OPTIONS, ignoreCase: true });
    const changes = override('line1\nLINE2\nline3\n', 'line1\nline2\nline3\n');
    expect(changes).toEqual([]);
  });

  it('ignoreWhitespace treats differently-spaced lines as unchanged', () => {
    const override = buildDiffOverride({ ...NO_OPTIONS, ignoreWhitespace: true });
    const changes = override('a\n  b   c  \nd\n', 'a\nb c\nd\n');
    expect(changes).toEqual([]);
  });

  it('ignoreLineEndings treats CRLF and LF as unchanged', () => {
    const override = buildDiffOverride({ ...NO_OPTIONS, ignoreLineEndings: true });
    const changes = override('a\r\nb\r\n', 'a\nb\n');
    expect(changes).toEqual([]);
  });

  it('ignoreBlankLines excludes blank lines from ever being reported as a change', () => {
    const override = buildDiffOverride({ ...NO_OPTIONS, ignoreBlankLines: true });
    // b has an extra blank line in the middle that a doesn't.
    const changes = override('a\nb\n', 'a\n\nb\n');
    expect(changes).toEqual([]);
  });

  it('still reports a genuine content change alongside an ignored dimension', () => {
    const override = buildDiffOverride({ ...NO_OPTIONS, ignoreCase: true });
    const changes = override('line1\nLINE2\nline3\n', 'line1\nline2\nline3\nline4\n');
    // Only the real addition (line4) should show up — the case-only line2
    // difference should not.
    expect(changes).toHaveLength(1);
    expect(changes[0].fromA).toBe(changes[0].toA); // pure insertion point in A
  });

  it('reports the correct B-side range for a pure insertion', () => {
    const override = buildDiffOverride({ ...NO_OPTIONS, ignoreCase: true });
    const b = 'line1\nline2\nline3\nline4\n';
    const changes = override('line1\nLINE2\nline3\n', b);
    expect(b.slice(changes[0].fromB, changes[0].toB)).toBe('line4\n');
  });

  it('falls back to the library\'s own precise diff above the LCS size cap', () => {
    const lineCount = 1001; // 1001*1001 > MAX_CELLS (1,000,000)
    const a = Array.from({ length: lineCount }, (_, i) => `a-line-${i}`).join('\n') + '\n';
    const b = Array.from({ length: lineCount }, (_, i) => `b-line-${i}`).join('\n') + '\n';
    const override = buildDiffOverride({ ...NO_OPTIONS, ignoreCase: true });
    expect(toRanges(override(a, b))).toEqual(toRanges(preciseDiff(a, b)));
  });
});
