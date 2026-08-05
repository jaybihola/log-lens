import { getIndexConfig } from '../settings.js';

// Minimal KQL-ish parser for the remote query's filter box. `field:value`,
// quoted phrases, AND/OR/NOT, parentheses, and bare free-text terms; no
// ranges or wildcarded field groups.
function kqlTokenize(input) {
  const re = /\(|\)|[^\s:()]+:"[^"]*"|[^\s:()]+:[^\s()]+|"[^"]*"|[^\s()]+/g;
  return input.match(re) ?? [];
}
function kqlClassify(token) {
  if (token === '(' || token === ')') return { type: token };
  if (/^and$/i.test(token)) return { type: 'AND' };
  if (/^or$/i.test(token)) return { type: 'OR' };
  if (/^not$/i.test(token)) return { type: 'NOT' };
  const colonIdx = token.indexOf(':');
  if (colonIdx > 0) {
    const field = token.slice(0, colonIdx);
    let value = token.slice(colonIdx + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    return { type: 'FIELD_VALUE', field, value };
  }
  let value = token;
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  return { type: 'TERM', value };
}
function kqlToClause(node) {
  if (node.type === 'FIELD_VALUE') return { match_phrase: { [node.field]: node.value } };
  if (node.type === 'TERM') return { query_string: { query: node.value } };
  if (node.type === 'NOT') return { bool: { must_not: [kqlToClause(node.expr)] } };
  if (node.type === 'AND') return { bool: { must: node.clauses.map(kqlToClause) } };
  if (node.type === 'OR') return { bool: { should: node.clauses.map(kqlToClause), minimum_should_match: 1 } };
  throw new Error(`Unknown node type: ${node.type}`);
}
export function parseKql(input) {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;
  const tokens = kqlTokenize(trimmed).map(kqlClassify);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of query');
    if (tok.type === '(') {
      next();
      const expr = parseOr();
      if (peek()?.type !== ')') throw new Error('Expected closing parenthesis');
      next();
      return expr;
    }
    if (tok.type === 'NOT') { next(); return { type: 'NOT', expr: parsePrimary() }; }
    if (tok.type === 'FIELD_VALUE' || tok.type === 'TERM') { next(); return tok; }
    throw new Error(`Unexpected token: ${JSON.stringify(tok)}`);
  }
  function parseAnd() {
    const clauses = [parsePrimary()];
    while (peek() && peek().type !== 'OR' && peek().type !== ')') {
      if (peek().type === 'AND') next();
      clauses.push(parsePrimary());
    }
    return clauses.length === 1 ? clauses[0] : { type: 'AND', clauses };
  }
  function parseOr() {
    const clauses = [parseAnd()];
    while (peek()?.type === 'OR') { next(); clauses.push(parseAnd()); }
    return clauses.length === 1 ? clauses[0] : { type: 'OR', clauses };
  }
  const ast = parseOr();
  if (pos < tokens.length) throw new Error(`Unexpected trailing token near: ${JSON.stringify(peek())}`);
  return kqlToClause(ast);
}

// A fold filter's selected chip values OR together (any of them matches).
function foldFilterClause(path, values) {
  if (values.length === 1) return { match_phrase: { [path]: values[0] } };
  return { bool: { should: values.map((v) => ({ match_phrase: { [path]: v } })), minimum_should_match: 1 } };
}

// Combines the configured fold-filter selections, a date range, and a raw
// KQL string into a single ES bool query. foldValues is
// { [filterKey]: string[] } — one entry per fold filter configured on this
// specific index (fold filters are per-index, since different indices in
// the same environment commonly have unrelated field schemas).
export function buildEsQuery(environment, { index, dateFrom, dateTo, kql, foldValues }) {
  const resolvedFoldValues = foldValues || {};
  const idxConfig = getIndexConfig(environment, index);
  const must = [];
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.gte = new Date(dateFrom).toISOString();
    if (dateTo) range.lte = new Date(dateTo).toISOString();
    must.push({ range: { '@timestamp': range } });
  }
  for (const filter of (idxConfig ? idxConfig.foldFilters : [])) {
    const values = resolvedFoldValues[filter.key];
    if (Array.isArray(values) && values.length) must.push(foldFilterClause(filter.path, values));
  }
  const kqlClause = parseKql(kql);
  if (kqlClause) must.push(kqlClause);
  if (must.length === 0) return { match_all: {} };
  return { bool: { must } };
}
