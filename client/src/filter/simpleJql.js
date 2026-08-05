import { jsonPathValue } from '../render/jsonPaths.js';

// JQL: this app's own small filter language (not Kibana's or Jira's) — AND
// (space-separated, default), OR (keyword, lower precedence), NOT (-term /
// -field:value), parentheses for grouping, "quoted phrases", "field:value" /
// "field:*" JSON-path filters (value is a substring match; "*" means "field
// present").
export function tokenize(query) {
  const tokens = [];
  // Alternatives, most specific first: standalone parens, "field":"value",
  // "field":value, field:"value", field:value, "quoted phrase", bare word —
  // each (other than parens) with an optional leading '-' for NOT.
  const re = /\(|\)|(-)?"([^"]+)":"([^"]*)"|(-)?"([^"]+)":(\S+)|(-)?([^\s:"()]+):"([^"]*)"|(-)?([^\s:"()]+):([^\s()]+)|(-)?"([^"]*)"|(-)?([^\s()]+)/g;
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
      tokens.push({ kind: 'field', field: m[11], value: m[12], negate: m[10] === '-' });
    } else if (m[14] !== undefined) {
      tokens.push({ kind: 'term', text: m[14], negate: m[13] === '-' });
    } else {
      const word = m[16];
      if (/^or$/i.test(word)) { tokens.push({ kind: 'op', op: 'OR' }); continue; }
      if (/^and$/i.test(word)) continue; // implicit; ignore explicit AND
      tokens.push({ kind: 'term', text: word, negate: m[15] === '-' });
    }
  }
  return tokens;
}

function fieldTokenMatches(line, token, caseSensitive) {
  const { present, value } = jsonPathValue(line, token.field);
  let has;
  if (token.value === '*') {
    has = present;
  } else {
    const haystack = caseSensitive ? value : value.toLowerCase();
    const needle = caseSensitive ? token.value : token.value.toLowerCase();
    has = present && haystack.includes(needle);
  }
  return token.negate ? !has : has;
}

function termTokenMatches(line, token, caseSensitive) {
  const haystack = caseSensitive ? line : line.toLowerCase();
  const needle = caseSensitive ? token.text : token.text.toLowerCase();
  const has = haystack.includes(needle);
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
    if (t.kind === 'field' || t.kind === 'term') { next(); return { type: 'LEAF', token: t }; }
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
    case 'LEAF': return node.token.kind === 'field'
      ? fieldTokenMatches(line, node.token, caseSensitive)
      : termTokenMatches(line, node.token, caseSensitive);
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

export function highlightTermsForSimple(query) {
  const out = [];
  for (const t of tokenize(query || '')) {
    if (t.negate) continue;
    if (t.kind === 'term' && t.text) out.push(t.text);
    else if (t.kind === 'field' && t.value && t.value !== '*') out.push(t.value);
  }
  return out;
}
