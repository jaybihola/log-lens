function positionToLineCol(text, pos) {
  const before = text.slice(0, pos);
  const lines = before.split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

// JSON.parse's error message format is engine-specific: V8 (Chrome/Node)
// gives "...at position 45", some engines give "...at line 3 column 2" —
// either way, extracts a single character offset into `text` when possible,
// or null when the message doesn't say (so callers can degrade gracefully
// rather than pointing at the wrong place).
function extractErrorPos(message, text) {
  const posMatch = /position (\d+)/.exec(message);
  if (posMatch) return Number(posMatch[1]);
  const lineColMatch = /line (\d+) column (\d+)/i.exec(message);
  if (lineColMatch) {
    const targetLine = Number(lineColMatch[1]);
    const targetCol = Number(lineColMatch[2]);
    const lines = text.split('\n');
    let pos = 0;
    for (let i = 0; i < targetLine - 1 && i < lines.length; i += 1) pos += lines[i].length + 1;
    return pos + (targetCol - 1);
  }
  return null;
}

// The raw form (message + character offset, or null) — used by the editor's
// inline lint diagnostic, which needs a real position to underline rather
// than a human-readable "(line N, col M)" suffix.
export function locateJsonError(text) {
  if (!text.trim()) return null;
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    return { message: e.message, pos: extractErrorPos(e.message, text) };
  }
}

// Wraps JSON.parse's error message with a line/col when the engine's own
// message includes a character offset but not already a line/column (V8
// sometimes reports both) — degrades gracefully to the raw message when
// neither is available. Used by the toolbar's status text; the editor's
// inline diagnostics use locateJsonError instead.
export function validateJson(text) {
  if (!text.trim()) return { valid: true, error: null };
  try {
    JSON.parse(text);
    return { valid: true, error: null };
  } catch (e) {
    let message = e.message;
    const hasLineCol = /line \d+ column \d+/i.test(message);
    const m = !hasLineCol && /position (\d+)/.exec(message);
    if (m) {
      const { line, col } = positionToLineCol(text, Number(m[1]));
      message = `${message} (line ${line}, col ${col})`;
    }
    return { valid: false, error: message };
  }
}

// Wraps arbitrary text as a JSON string literal ({"a":1} -> "{\"a\":1}") —
// for embedding raw JSON as a string value elsewhere. Never throws (any
// string can be JSON.stringify'd).
export function escapeJsonString(text) {
  return JSON.stringify(text);
}

// The inverse: text that's itself a JSON string literal ("{\"a\":1}") ->
// the unescaped content ({"a":1}). Throws if `text` doesn't parse as a JSON
// string (not JSON at all, or an object/array/number instead of a string) —
// callers treat that the same as any other invalid-input transform failure.
export function unescapeJsonString(text) {
  const parsed = JSON.parse(text);
  if (typeof parsed !== 'string') throw new Error('Not a JSON-encoded string');
  return parsed;
}

export function sortJsonKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortJsonKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => {
      acc[k] = sortJsonKeysDeep(value[k]);
      return acc;
    }, {});
  }
  return value;
}

// Throws (with the same message validateJson would surface) on invalid
// JSON — callers should check validateJson first if they want to avoid a
// try/catch at the call site.
export function formatJsonText(text, { indent = 2, sortKeys = false } = {}) {
  let parsed = JSON.parse(text);
  if (sortKeys) parsed = sortJsonKeysDeep(parsed);
  return JSON.stringify(parsed, null, indent === 'tab' ? '\t' : indent);
}

export function minifyJsonText(text, { sortKeys = false } = {}) {
  let parsed = JSON.parse(text);
  if (sortKeys) parsed = sortJsonKeysDeep(parsed);
  return JSON.stringify(parsed);
}

// Ordered-subsequence fuzzy match, case-insensitive — the same class of
// matcher as most "quick open" file pickers: not a ranking engine, just
// "could you type this as a subsequence of that key".
export function fuzzyMatchKey(query, key) {
  if (!query) return true;
  const q = query.toLowerCase();
  const k = key.toLowerCase();
  let qi = 0;
  for (let ki = 0; ki < k.length && qi < q.length; ki += 1) {
    if (k[ki] === q[qi]) qi += 1;
  }
  return qi === q.length;
}

// All distinct key names present anywhere in the tree (any depth, inside
// arrays too) — the candidate list a fuzzy search picks from.
export function collectDistinctKeys(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectDistinctKeys(item, out);
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      out.add(key);
      collectDistinctKeys(v, out);
    }
  }
  return out;
}

// The "search" step (fuzzy, exploratory) — separate from the "apply" step
// below (exact, once you've picked which of the matches you actually want).
// { ok, error, names } — names is every distinct key in the document that
// fuzzy-matches `query`, sorted.
export function findMatchingFieldNames(text, query) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e.message, names: [] };
  }
  const trimmed = query.trim();
  if (!trimmed) return { ok: true, error: null, names: [] };
  const names = [...collectDistinctKeys(parsed)].filter((k) => fuzzyMatchKey(trimmed, k)).sort();
  return { ok: true, error: null, names };
}

// Recursively keeps only keys in `keySet` (exact match), plus whatever
// ancestor keys are needed to reach one further down — so "only these
// fields are visible" still shows you where each lives instead of an
// orphaned value. A key that's in the set keeps its *entire* subtree
// unpruned (you asked for that field, so you get all of it). Arrays keep
// whichever elements (after recursing) still have something left. Returns
// undefined when nothing under `value` matches, so callers can tell "no
// matches" apart from "matched but empty".
function pruneByKeySet(value, keySet) {
  if (Array.isArray(value)) {
    const items = value.map((item) => pruneByKeySet(item, keySet)).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const result = {};
    let any = false;
    for (const [key, v] of Object.entries(value)) {
      if (keySet.has(key)) {
        result[key] = v;
        any = true;
      } else {
        const pruned = pruneByKeySet(v, keySet);
        if (pruned !== undefined) {
          result[key] = pruned;
          any = true;
        }
      }
    }
    return any ? result : undefined;
  }
  return undefined; // a bare primitive has no key of its own to match
}

// The "apply" step — an exact set of field names (however they got picked:
// a single unambiguous search match, or several chosen from a picker),
// ANDed as "any of these". { ok, error, resultText, matched } — `ok` is
// false only on a JSON parse error (distinct from `matched: false`, which
// means it parsed fine but none of `fieldNames` occur anywhere).
export function filterJsonByFields(text, fieldNames, { indent = 2 } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e.message, resultText: '', matched: false };
  }
  if (!fieldNames || fieldNames.length === 0) return { ok: true, error: null, resultText: '', matched: false };
  const pruned = pruneByKeySet(parsed, new Set(fieldNames));
  if (pruned === undefined) {
    return { ok: true, error: null, resultText: '', matched: false };
  }
  return { ok: true, error: null, resultText: JSON.stringify(pruned, null, indent === 'tab' ? '\t' : indent), matched: true };
}

// ---- table view helpers (pure, no React) — used by JsonTableView.jsx ----

// The six buckets the table view cares about — finer-grained than typeof
// (splits array from object, null from object) since each renders/labels
// differently.
export function getJsonValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'object' | 'string' | 'number' | 'boolean' | 'undefined'
}

// A one-line summary for a collapsed object/array row's value column —
// mirrors what most JSON tree tables (Kibana included) show before you
// expand: a count, not the actual nested content.
export function jsonValuePreview(value) {
  const type = getJsonValueType(value);
  if (type === 'array') return value.length === 1 ? '[1 item]' : `[${value.length} items]`;
  if (type === 'object') {
    const n = Object.keys(value).length;
    return n === 1 ? '{1 key}' : `{${n} keys}`;
  }
  return String(value);
}

// Parses `text` for the table view; distinct from validateJson/locateJsonError
// (which serve the toolbar status text / editor lint gutter respectively) —
// this one just needs a boolean + the parsed value or an error message.
export function parseJsonForTable(text) {
  if (!text.trim()) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
