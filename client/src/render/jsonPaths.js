// JSON extraction: log entries are frequently a JSON object (or contain one)
// or plain text. Try the whole entry, then each physical line independently,
// then scan for the first balanced {...} substring anywhere in the text.

// Scans forward from 'start' (which must be '{' or '[') for the matching
// close, respecting quoted strings, so embedded JSON can be pulled out of a
// larger message.
export function findBalancedJson(text, start) {
  const stack = [];
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) { esc = false; } else if (c === '\\') { esc = true; } else if (c === '"') { inStr = false; }
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{' || c === '[') { stack.push(c); continue; }
    if (c === '}' || c === ']') {
      if (!stack.length) return null;
      const open = stack.pop();
      if ((open === '{' && c !== '}') || (open === '[' && c !== ']')) return null;
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function tryParseJsonObject(text) {
  const trimmed = text.trim();
  if (trimmed[0] !== '{') return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

// Deliberately only looks for '{' — dotnet console lines like "Category[0]"
// would otherwise false-match '[0]' as a tiny (and useless) JSON array.
function findEmbeddedJsonObject(text) {
  const re = /\{/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const candidate = findBalancedJson(text, m.index);
    if (candidate) {
      try { return JSON.parse(candidate); } catch { /* keep scanning */ }
    }
    re.lastIndex = m.index + 1;
  }
  return null;
}

// Not every entry is pure JSON top-to-bottom — a continuation-joined entry
// can bundle a plain-text header line with a JSON payload line — so fall back
// progressively: whole text, then each physical line on its own, then any
// '{...}' object embedded anywhere.
export function resolveJsonObject(text) {
  let obj = tryParseJsonObject(text);
  if (!obj) {
    for (const line of text.split('\n')) {
      obj = tryParseJsonObject(line);
      if (obj) break;
    }
  }
  if (!obj) obj = findEmbeddedJsonObject(text);
  return obj;
}

// Splits a dot/bracket keyPath (e.g. "Tags[0].Name") into plain lookup keys
// ["Tags", "0", "Name"] — array indices are just numeric string keys, which
// JS objects/arrays both accept.
export function splitKeyPath(keyPath) {
  return keyPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter((p) => p.length > 0);
}

function resolveColumnRaw(text, keyPath) {
  const obj = resolveJsonObject(text);
  if (!obj || typeof obj !== 'object') return undefined;
  let cur = obj;
  for (const part of splitKeyPath(keyPath)) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

// Used by extra columns: the stringified value at a dot-path, or '' when the
// entry isn't JSON or simply doesn't have that key. A column pointed at an
// object/array (e.g. a folder added as a column from the fields sidebar)
// gets the whole subtree JSON.stringify'd — see isColumnValueObject, which
// tells the caller when that's what happened so it can be syntax-
// highlighted the same way the raw message column is.
export function getColumnValue(text, keyPath) {
  const cur = resolveColumnRaw(text, keyPath);
  if (cur === undefined || cur === null) return '';
  return typeof cur === 'object' ? JSON.stringify(cur) : String(cur);
}

export function isColumnValueObject(text, keyPath) {
  const cur = resolveColumnRaw(text, keyPath);
  return cur !== undefined && cur !== null && typeof cur === 'object';
}

// Distinguishes "field missing" from "field present but null/undefined" —
// dot-path resolution shared by every path lookup below.
export function jsonPathRawValue(text, keyPath) {
  const obj = resolveJsonObject(text);
  if (!obj || typeof obj !== 'object') return { present: false, raw: undefined };
  let cur = obj;
  const parts = splitKeyPath(keyPath);
  for (let i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object' || !(parts[i] in cur)) return { present: false, raw: undefined };
    cur = cur[parts[i]];
  }
  return { present: true, raw: cur };
}

// Presence filters (field:*, only:) need "is this field present" separate
// from the substring filters' stringified value.
export function jsonPathValue(text, keyPath) {
  const { present, raw } = jsonPathRawValue(text, keyPath);
  if (!present) return { present: false, value: '' };
  const value = raw === undefined || raw === null ? '' : (typeof raw === 'object' ? JSON.stringify(raw) : String(raw));
  return { present: true, value };
}
