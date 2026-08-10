import { Change, diff as preciseDiff } from '@codemirror/merge';

// Above this many (kept-line-A x kept-line-B) cells, the LCS table below
// would get expensive to rebuild on every keystroke — silently falls back to
// the library's own precise diff instead of hanging the tab. Ignore-options
// simply stop applying past this size rather than erroring.
const MAX_CELLS = 1_000_000;

function isBlank(raw) {
  return raw.trim() === '';
}

function normalizeLine(raw, options) {
  let s = raw;
  if (options.ignoreLineEndings) s = s.replace(/\r$/, '');
  if (options.ignoreWhitespace) s = s.trim().replace(/\s+/g, ' ');
  if (options.ignoreCase) s = s.toLowerCase();
  return s;
}

// Lines covering the whole string with no gaps: `end` includes the line's
// own trailing newline (so consecutive lines are contiguous, and a deletion
// spanning [start, end) removes the line as a whole line, newline included).
// A trailing newline terminates the last real line rather than starting a
// new (phantom, empty) one — text with N newlines that ends in "\n" has
// exactly N lines, matching how git/GNU diff count them.
function splitLines(text) {
  const lines = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      lines.push({ raw: text.slice(start, i), start, end: i + 1 });
      start = i + 1;
    }
  }
  if (start < text.length) lines.push({ raw: text.slice(start), start, end: text.length });
  return lines;
}

// Classic DP LCS + backtrack. Returns matched [aIndex, bIndex] pairs in
// increasing order — everything not covered by a pair is a changed line.
function lcsPairs(a, b) {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return [];
  const stride = m + 1;
  const dp = new Uint32Array((n + 1) * stride);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i * stride + j] = a[i - 1] === b[j - 1]
        ? dp[(i - 1) * stride + (j - 1)] + 1
        : Math.max(dp[(i - 1) * stride + j], dp[i * stride + (j - 1)]);
    }
  }
  const pairs = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--; j--;
    } else if (dp[(i - 1) * stride + j] >= dp[i * stride + (j - 1)]) {
      i--;
    } else {
      j--;
    }
  }
  pairs.reverse();
  return pairs;
}

function lineLevelDiff(a, b, options) {
  const linesA = splitLines(a);
  const linesB = splitLines(b);
  const keptA = options.ignoreBlankLines ? linesA.filter((l) => !isBlank(l.raw)) : linesA;
  const keptB = options.ignoreBlankLines ? linesB.filter((l) => !isBlank(l.raw)) : linesB;

  if (keptA.length * keptB.length > MAX_CELLS) return preciseDiff(a, b);

  const normA = keptA.map((l) => normalizeLine(l.raw, options));
  const normB = keptB.map((l) => normalizeLine(l.raw, options));
  const pairs = lcsPairs(normA, normB);

  // Virtual sync points bracket the real matches so the gap-based loop below
  // also covers a leading/trailing changed run without special-casing them.
  const syncs = [[-1, -1], ...pairs, [keptA.length, keptB.length]];
  const changes = [];
  for (let s = 0; s < syncs.length - 1; s++) {
    const [prevA, prevB] = syncs[s];
    const [nextA, nextB] = syncs[s + 1];
    const aFromIdx = prevA + 1;
    const aToIdx = nextA - 1;
    const bFromIdx = prevB + 1;
    const bToIdx = nextB - 1;
    const aChanged = aFromIdx <= aToIdx;
    const bChanged = bFromIdx <= bToIdx;
    if (!aChanged && !bChanged) continue;
    const fromA = aChanged ? keptA[aFromIdx].start : (prevA >= 0 ? keptA[prevA].end : 0);
    const toA = aChanged ? keptA[aToIdx].end : fromA;
    const fromB = bChanged ? keptB[bFromIdx].start : (prevB >= 0 ? keptB[prevB].end : 0);
    const toB = bChanged ? keptB[bToIdx].end : fromB;
    changes.push(new Change(fromA, toA, fromB, toB));
  }
  return changes;
}

function hasActiveOptions(options) {
  return !!(options?.ignoreWhitespace || options?.ignoreCase || options?.ignoreBlankLines || options?.ignoreLineEndings);
}

// Builds the `diffConfig.override` @codemirror/merge expects: a full
// replacement for its diff algorithm, not an equality tweak (the library has
// no such hook). So this runs its own line-level LCS over normalized lines
// instead — meaning, by design, word/char-level intraline highlighting is
// lost while any ignore-option is active (a changed line just shows as
// changed). With nothing active, returns `null` so callers skip the override
// entirely and get the library's own precise word-level diff.
export function buildDiffOverride(options) {
  if (!hasActiveOptions(options)) return null;
  return (a, b) => lineLevelDiff(a, b, options);
}
