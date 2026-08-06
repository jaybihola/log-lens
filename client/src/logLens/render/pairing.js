import { tryParseJsonObject } from './jsonPaths.js';

// Many structured logging setups emit each event twice: once as a structured
// JSON payload, once as a traditional leveled console line, with no shared
// identifier — only a shared "category" name. They're two separate physical
// entries (can't be merged), but we can detect and visually link them.
const CONSOLE_LEVEL_RE = /^(trce|dbug|info|warn|fail|crit):\s*(.*)$/i;

// Match by logger category rather than message text: some calls log a
// structured event object with no plain message string at all, where the
// console sink just prints the object's type name — there's no shared
// message text to match on, but the category is always identical.
function isJsonConsolePair(jsonEntry, consoleEntry) {
  const obj = tryParseJsonObject(jsonEntry.text);
  if (!obj || typeof obj.Name !== 'string') return false;
  const headerLine = consoleEntry.text.split('\n')[0];
  const m = CONSOLE_LEVEL_RE.exec(headerLine);
  if (!m) return false;
  const category = m[2].replace(/\[\d+\]\s*$/, '').trim();
  return category.length > 0 && category === obj.Name.trim();
}

// The two halves of a call aren't always back-to-back — other calls' entries
// can land between them when sinks flush asynchronously — so search a small
// forward window instead of only the immediate next line, taking the
// nearest match.
const PAIR_SEARCH_WINDOW = 12;

export function computePairs(lines) {
  const map = new Map();
  const used = new Set();
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    if (used.has(a.seq)) continue;
    for (let d = 1; d <= PAIR_SEARCH_WINDOW && i + d < lines.length; d++) {
      const b = lines[i + d];
      if (used.has(b.seq)) continue;
      if (isJsonConsolePair(a, b) || isJsonConsolePair(b, a)) {
        map.set(a.seq, b.seq);
        map.set(b.seq, a.seq);
        used.add(a.seq);
        used.add(b.seq);
        break;
      }
    }
  }
  return map;
}

// Cycles through a small palette by pair index so consecutive pairs stay
// visually distinct instead of all blending into one indistinguishable block.
const PAIR_PALETTE = ['#6a5acd', '#20b2aa', '#cd5a8f', '#c9a227', '#4682b4', '#8a5a44'];
export function pairColor(pairId) {
  return PAIR_PALETTE[pairId % PAIR_PALETTE.length];
}
