const CONTEXT_LINES = 3;

function offsetToLineIndex(text, offset) {
  let line = 0;
  for (let i = 0; i < offset; i++) if (text[i] === '\n') line++;
  return line;
}

// A trailing newline terminates the last real line rather than starting a
// new empty one — must match diffEngine.js's splitLines exactly, since
// chunk offsets from either the library's own diff or our override assume
// this same line count.
function splitLines(text) {
  return text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
}

// A Chunk's [fromA, toA) is line-aligned (one past the end of the last
// changed line) — convert to a 0-indexed, exclusive [start, end) line range.
function chunkLineRange(chunk, leftText, rightText) {
  const aStart = offsetToLineIndex(leftText, chunk.fromA);
  const aEnd = chunk.toA > chunk.fromA ? offsetToLineIndex(leftText, chunk.toA - 1) + 1 : aStart;
  const bStart = offsetToLineIndex(rightText, chunk.fromB);
  const bEnd = chunk.toB > chunk.fromB ? offsetToLineIndex(rightText, chunk.toB - 1) + 1 : bStart;
  return { aStart, aEnd, bStart, bEnd };
}

// Groups nearby chunks into hunks, expanding each by `context` lines of
// surrounding unchanged text and merging any whose expanded windows overlap
// — the same convention `git diff`/GNU diff use. The pre/post-chunk gap
// length is always identical on the A and B side (it's the same unchanged
// lines, mirrored), so clamping each side's window independently at the
// document edges still keeps both sides in lockstep.
function buildHunks(ranges, linesA, linesB, context) {
  const hunks = [];
  for (const r of ranges) {
    const winAFrom = Math.max(0, r.aStart - context);
    const winATo = Math.min(linesA.length, r.aEnd + context);
    const winBFrom = Math.max(0, r.bStart - context);
    const winBTo = Math.min(linesB.length, r.bEnd + context);
    const last = hunks[hunks.length - 1];
    if (last && winAFrom <= last.aTo) {
      last.aTo = Math.max(last.aTo, winATo);
      last.bTo = Math.max(last.bTo, winBTo);
      last.chunks.push(r);
    } else {
      hunks.push({ aFrom: winAFrom, aTo: winATo, bFrom: winBFrom, bTo: winBTo, chunks: [r] });
    }
  }
  return hunks;
}

function renderHunk(hunk, linesA, linesB) {
  const aCount = hunk.aTo - hunk.aFrom;
  const bCount = hunk.bTo - hunk.bFrom;
  const lines = [`@@ -${aCount ? hunk.aFrom + 1 : hunk.aFrom},${aCount} +${bCount ? hunk.bFrom + 1 : hunk.bFrom},${bCount} @@`];
  let curA = hunk.aFrom;
  let curB = hunk.bFrom;
  for (const r of hunk.chunks) {
    for (; curA < r.aStart; curA++, curB++) lines.push(` ${linesA[curA]}`);
    for (let k = r.aStart; k < r.aEnd; k++) lines.push(`-${linesA[k]}`);
    for (let k = r.bStart; k < r.bEnd; k++) lines.push(`+${linesB[k]}`);
    curA = r.aEnd;
    curB = r.bEnd;
  }
  for (; curA < hunk.aTo; curA++, curB++) lines.push(` ${linesA[curA]}`);
  return lines;
}

// `chunks` is whatever @codemirror/merge's `MergeView.chunks` / `getChunks`
// returned for the current comparison — each with fromA/toA/fromB/toB
// character offsets. Produces standard unified-diff text (no "\ No newline
// at end of file" marker — good enough for copy/export, not aiming for
// byte-exact `git apply` fidelity on that one edge case).
export function buildUnifiedDiff(leftText, rightText, chunks, { leftLabel = 'a', rightLabel = 'b', context = CONTEXT_LINES } = {}) {
  if (!chunks.length) return '';
  const linesA = splitLines(leftText);
  const linesB = splitLines(rightText);
  const ranges = chunks.map((c) => chunkLineRange(c, leftText, rightText));
  const hunks = buildHunks(ranges, linesA, linesB, context);
  const out = [`--- ${leftLabel}`, `+++ ${rightLabel}`];
  for (const hunk of hunks) out.push(...renderHunk(hunk, linesA, linesB));
  return out.join('\n');
}
