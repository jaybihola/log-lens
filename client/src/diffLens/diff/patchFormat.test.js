import { describe, expect, it } from 'vitest';
import { Chunk } from '@codemirror/merge';
import { Text } from '@codemirror/state';
import { buildUnifiedDiff } from './patchFormat.js';

// Uses Chunk.build (line-aligned) rather than the library's raw character-
// level diff() — patchFormat.js assumes line-aligned chunks, exactly what
// MergeView.chunks/getChunks() give it in the real app. Building against
// the wrong kind of chunk was a real bug caught during manual testing this
// session (see diffLens/README.md).
function chunksFor(a, b) {
  return Chunk.build(Text.of(a.split('\n')), Text.of(b.split('\n')));
}

describe('buildUnifiedDiff', () => {
  it('returns an empty string for no chunks', () => {
    expect(buildUnifiedDiff('a\n', 'a\n', [])).toBe('');
  });

  it('produces headers and a correct hunk for a single-line modification', () => {
    const a = 'line1\nline2\nline3\n';
    const b = 'line1\nCHANGED\nline3\n';
    const patch = buildUnifiedDiff(a, b, chunksFor(a, b), { leftLabel: 'a', rightLabel: 'b' });
    expect(patch).toBe('--- a\n+++ b\n@@ -1,3 +1,3 @@\n line1\n-line2\n+CHANGED\n line3');
  });

  it('does not emit a spurious trailing blank context line when the text ends with a newline', () => {
    const a = 'line1\nline2\nline3\nline4\nline5\n';
    const b = 'line1\nline2\nline3\nline4\nline6\n';
    const patch = buildUnifiedDiff(a, b, chunksFor(a, b));
    expect(patch.endsWith('\n')).toBe(false);
    expect(patch).not.toContain('\n \n'); // no lone blank context line
  });

  it('handles a pure insertion at the start of the file', () => {
    const a = 'b\nc\n';
    const b = 'a\nb\nc\n';
    const patch = buildUnifiedDiff(a, b, chunksFor(a, b));
    expect(patch).toContain('+a');
    expect(patch).not.toMatch(/\n\s*\n/); // no stray blank lines anywhere
  });

  it('handles a pure deletion at the end of the file', () => {
    const a = 'a\nb\nc\n';
    const b = 'a\nb\n';
    const patch = buildUnifiedDiff(a, b, chunksFor(a, b));
    expect(patch).toContain('-c');
  });

  it('merges two nearby chunks into a single hunk with correct headers', () => {
    const a = Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n') + '\n';
    const lines = a.split('\n');
    lines[2] = 'CHANGED-A';
    lines[5] = 'CHANGED-B';
    const b = lines.join('\n');
    const patch = buildUnifiedDiff(a, b, chunksFor(a, b));
    // Both changes are within 3-line context of each other -> one @@ hunk.
    expect(patch.match(/^@@/gm)).toHaveLength(1);
    expect(patch).toContain('-line2');
    expect(patch).toContain('+CHANGED-A');
    expect(patch).toContain('-line5');
    expect(patch).toContain('+CHANGED-B');
  });

  it('splits two far-apart chunks into separate hunks', () => {
    const lineCount = 40;
    const a = Array.from({ length: lineCount }, (_, i) => `line${i}`).join('\n') + '\n';
    const lines = a.split('\n');
    lines[1] = 'CHANGED-A';
    lines[30] = 'CHANGED-B';
    const b = lines.join('\n');
    const patch = buildUnifiedDiff(a, b, chunksFor(a, b));
    expect(patch.match(/^@@/gm)).toHaveLength(2);
  });

  it('produces a hunk header whose counts match the actual line ranges', () => {
    const a = 'a\nb\nc\n';
    const b = 'a\nX\nc\n';
    const patch = buildUnifiedDiff(a, b, chunksFor(a, b));
    // Whole 3-line file fits in one hunk with 3-line default context.
    expect(patch).toContain('@@ -1,3 +1,3 @@');
  });
});
