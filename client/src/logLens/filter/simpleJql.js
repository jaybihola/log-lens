import { jsonPathRawValue } from '../render/jsonPaths.js';

// JQL: this app's own small filter language (not Kibana's or Jira's) — AND
// (space-separated, default), OR (keyword, lower precedence), NOT (-term /
// -field:value), parentheses for grouping, "quoted phrases", "field:value" /
// "field:*" JSON-path filters (value is a substring match; "*" means "field
// present" — the key exists, whether or not its value is null),
// "field:(v1,v2,v3)" ("field is one of these values" — an OR over the list),
// and "*" as a wildcard inside any value ("err*" / "*Exception" / "a*b") —
// see globFullMatch/globSearch below for exactly what that anchors against.
//
// "field present" and "value is null" are deliberately kept distinct (a
// missing key and an explicit `null` are different things in JSON, and a
// log can legitimately have either): "field:null" means the key exists AND
// its value is null; "-field:*" means the key doesn't exist at all. To ask
// for "present with a real (non-null) value", combine them with the
// language's normal AND: "field:* -field:null".
export function tokenize(query) {
  const tokens = [];
  // Alternatives, most specific first: standalone parens, "field":"value",
  // "field":value, field:"value", field:(v1,v2), field:value, "quoted
  // phrase", bare word — each (other than parens) with an optional leading
  // '-' for NOT.
  const re = /\(|\)|(-)?"([^"]+)":"([^"]*)"|(-)?"([^"]+)":(\S+)|(-)?([^\s:"()]+):"([^"]*)"|(-)?([^\s:"()]+):\(([^()]*)\)|(-)?([^\s:"()]+):([^\s()]+)|(-)?"([^"]*)"|(-)?([^\s()]+)/g;
  let m;
  while ((m = re.exec(query)) !== null) {
    if (m[0] === '(' || m[0] === ')') {
      tokens.push({ kind: 'paren', value: m[0] });
    } else if (m[2] !== undefined) {
      tokens.push({ kind: 'field', field: m[2], value: m[3], negate: m[1] === '-' });
    } else if (m[5] !== undefined) {
      tokens.push({ kind: 'field', field: m[5], value: m[6], negate: m[4] === '-' });
    } else if (m[8] !== undefined) {
      tokens.push({ kind: 'field', field: m[8], value: m[9], negate: m[7] === '-' });
    } else if (m[11] !== undefined) {
      const values = m[12].split(',').map((v) => v.trim()).filter(Boolean);
      tokens.push({ kind: 'field-in', field: m[11], values, negate: m[10] === '-' });
    } else if (m[14] !== undefined) {
      tokens.push({ kind: 'field', field: m[14], value: m[15], negate: m[13] === '-' });
    } else if (m[17] !== undefined) {
      tokens.push({ kind: 'term', text: m[17], negate: m[16] === '-' });
    } else {
      const word = m[19];
      if (/^or$/i.test(word)) { tokens.push({ kind: 'op', op: 'OR' }); continue; }
      if (/^and$/i.test(word)) continue; // implicit; ignore explicit AND
      tokens.push({ kind: 'term', text: word, negate: m[18] === '-' });
    }
  }
  return tokens;
}

function escapeRegExpLiteral(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globSource(pattern) {
  return pattern.split('*').map(escapeRegExpLiteral).join('.*');
}

// Field values: "*" anchors against the whole value (Elasticsearch's own
// wildcard-query convention) — "err*" means "starts with err", not "contains
// err anywhere" (which plain "err", with no wildcard, already covers).
function globFullMatch(value, pattern, caseSensitive) {
  return new RegExp(`^${globSource(pattern)}$`, caseSensitive ? '' : 'i').test(value);
}

// Bare terms: "*" searches for the pattern anywhere in the line (unanchored)
// — anchoring the *entire* line would be useless against a full log line.
function globSearch(text, pattern, caseSensitive) {
  return new RegExp(globSource(pattern), caseSensitive ? '' : 'i').test(text);
}

// Whether a single field:value comparison holds, given the field's raw JSON
// value — shared by fieldTokenMatches and fieldInTokenMatches so "one of
// these values" gets wildcard/null/presence handling for free on each item.
function fieldValueMatches(present, raw, value, caseSensitive) {
  if (value === '*') return present;
  if (value === 'null') return present && raw === null;
  if (!present) return false;
  const strValue = raw === undefined || raw === null ? '' : (typeof raw === 'object' ? JSON.stringify(raw) : String(raw));
  if (value.includes('*')) return globFullMatch(strValue, value, caseSensitive);
  const haystack = caseSensitive ? strValue : strValue.toLowerCase();
  const needle = caseSensitive ? value : value.toLowerCase();
  return haystack.includes(needle);
}

function fieldTokenMatches(line, token, caseSensitive) {
  const { present, raw } = jsonPathRawValue(line, token.field);
  const has = fieldValueMatches(present, raw, token.value, caseSensitive);
  return token.negate ? !has : has;
}

// "field:(v1,v2,v3)" — true if the field matches ANY of the listed values
// (each evaluated with the same presence/null/wildcard rules as a plain
// field:value token).
function fieldInTokenMatches(line, token, caseSensitive) {
  const { present, raw } = jsonPathRawValue(line, token.field);
  const has = token.values.some((v) => fieldValueMatches(present, raw, v, caseSensitive));
  return token.negate ? !has : has;
}

function termTokenMatches(line, token, caseSensitive) {
  let has;
  if (token.text.includes('*')) {
    has = globSearch(line, token.text, caseSensitive);
  } else {
    const haystack = caseSensitive ? line : line.toLowerCase();
    const needle = caseSensitive ? token.text : token.text.toLowerCase();
    has = haystack.includes(needle);
  }
  return token.negate ? !has : has;
}

// Recursive-descent parser: OR (lowest precedence), implicit AND (adjacent
// atoms), parenthesized groups, leaf field/term tokens.
export function parseSimpleAst(tokens) {
  tokens = tokens.filter((t) => t.kind !== 'term' || (t.text && t.text.length > 0));
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const atEnd = () => !peek() || (peek().kind === 'op' && peek().op === 'OR') || (peek().kind === 'paren' && peek().value === ')');

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().kind === 'op' && peek().op === 'OR') {
      next();
      left = { type: 'OR', left, right: parseAnd() };
    }
    return left;
  }
  function parseAnd() {
    let left = parseAtom();
    while (!atEnd()) left = { type: 'AND', left, right: parseAtom() };
    return left;
  }
  function parseAtom() {
    const t = peek();
    if (!t) throw new Error('Unexpected end of query');
    if (t.kind === 'paren' && t.value === '(') {
      next();
      const inner = parseOr();
      if (!(peek() && peek().kind === 'paren' && peek().value === ')')) throw new Error('Missing closing )');
      next();
      return inner;
    }
    if (t.kind === 'paren' && t.value === ')') throw new Error('Unexpected )');
    if (t.kind === 'field' || t.kind === 'term' || t.kind === 'field-in') { next(); return { type: 'LEAF', token: t }; }
    throw new Error('Unexpected token');
  }

  if (!tokens.length) return null;
  const ast = parseOr();
  if (pos < tokens.length) throw new Error('Unexpected trailing token');
  return ast;
}

function evalSimpleAst(node, line, caseSensitive) {
  switch (node.type) {
    case 'AND': return evalSimpleAst(node.left, line, caseSensitive) && evalSimpleAst(node.right, line, caseSensitive);
    case 'OR': return evalSimpleAst(node.left, line, caseSensitive) || evalSimpleAst(node.right, line, caseSensitive);
    case 'LEAF':
      if (node.token.kind === 'field') return fieldTokenMatches(line, node.token, caseSensitive);
      if (node.token.kind === 'field-in') return fieldInTokenMatches(line, node.token, caseSensitive);
      return termTokenMatches(line, node.token, caseSensitive);
    default: return false;
  }
}

// Throws on unbalanced/malformed parentheses so the caller can surface a
// parse error instead of silently matching nothing/everything.
export function buildSimpleMatcher(query, caseSensitive) {
  const ast = parseSimpleAst(tokenize(query || ''));
  if (!ast) return () => true;
  return (line) => evalSimpleAst(ast, line, caseSensitive);
}

// Whether `query` has a top-level (paren-depth 0) OR — i.e. whether AND-ing
// one more bare token onto its end would only bind to the last OR branch
// instead of gating the whole expression (AND binds tighter than OR, and a
// trailing bare atom associates with whatever immediately precedes it — see
// parseAnd in parseSimpleAst). A caller appending a new clause needs this to
// know whether the existing query first needs wrapping in parens.
export function hasTopLevelOr(query) {
  let depth = 0;
  for (const t of tokenize(query || '')) {
    if (t.kind === 'paren' && t.value === '(') depth += 1;
    else if (t.kind === 'paren' && t.value === ')') depth -= 1;
    else if (t.kind === 'op' && t.op === 'OR' && depth === 0) return true;
  }
  return false;
}

export function highlightTermsForSimple(query) {
  const out = [];
  const isHighlightable = (v) => v && v !== '*' && v !== 'null';
  for (const t of tokenize(query || '')) {
    if (t.negate) continue;
    if (t.kind === 'term' && t.text) out.push(t.text);
    else if (t.kind === 'field' && isHighlightable(t.value)) out.push(t.value);
    else if (t.kind === 'field-in') t.values.filter(isHighlightable).forEach((v) => out.push(v));
  }
  return out;
}
