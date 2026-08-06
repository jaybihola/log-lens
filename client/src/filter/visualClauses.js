import { tokenize } from './simpleJql.js';

// Bridges the visual filter builder to the same JQL text that drives
// matching — there's no separate "visual query" state; the builder just
// reads/writes the tab's normal filterQuery string.
//
// The visual model is always a list of GROUPS: clauses within a group are
// ANDed, groups are ORed against each other — i.e. disjunctive-normal-form,
// (a AND b) OR (c). The common case (one group) needs no parens at all,
// since AND already binds tighter than OR in this grammar; multiple groups
// serialize as "(a b) OR (c)". A query decomposes into groups only when
// it's *entirely* that shape (no bare terms, no nested parens/OR inside a
// group); anything else is kept as a single opaque "advanced" pill rather
// than risk misrepresenting it — toggling back to text mode always shows
// the exact, unmodified string either way.
export const OPERATORS = [
  { id: 'is', label: 'is', arity: 'one' },
  { id: 'is_not', label: 'is not', arity: 'one' },
  { id: 'in', label: 'is one of', arity: 'many' },
  { id: 'not_in', label: 'is not one of', arity: 'many' },
  { id: 'exists', label: 'exists', arity: 'none' },
  { id: 'not_exists', label: 'does not exist', arity: 'none' },
  { id: 'is_null', label: 'is null', arity: 'none' },
  { id: 'is_not_null', label: 'is not null', arity: 'none' },
];

export function operatorLabel(id) {
  return OPERATORS.find((o) => o.id === id)?.label || id;
}

export function operatorArity(id) {
  return OPERATORS.find((o) => o.id === id)?.arity || 'one';
}

function quoteIfNeeded(v) {
  return /[\s"()]/.test(v) || v === '' ? `"${v}"` : v;
}

function tokenToClause(t, id) {
  if (t.kind === 'field-in') {
    return { id, field: t.field, operator: t.negate ? 'not_in' : 'in', values: t.values };
  }
  if (t.value === '*') return { id, field: t.field, operator: t.negate ? 'not_exists' : 'exists', values: [] };
  if (t.value === 'null') return { id, field: t.field, operator: t.negate ? 'is_not_null' : 'is_null', values: [] };
  return { id, field: t.field, operator: t.negate ? 'is_not' : 'is', values: [t.value] };
}

export function clauseToJql({ field, operator, values }) {
  const v0 = values[0] ?? '';
  switch (operator) {
    case 'is': return `${field}:${quoteIfNeeded(v0)}`;
    case 'is_not': return `-${field}:${quoteIfNeeded(v0)}`;
    case 'in': return `${field}:(${values.join(',')})`;
    case 'not_in': return `-${field}:(${values.join(',')})`;
    case 'exists': return `${field}:*`;
    case 'not_exists': return `-${field}:*`;
    case 'is_null': return `${field}:null`;
    case 'is_not_null': return `-${field}:null`;
    default: return '';
  }
}

export function clauseLabel({ field, operator, values }) {
  const opLabel = operatorLabel(operator);
  return values.length ? `${field} ${opLabel} ${values.join(', ')}` : `${field} ${opLabel}`;
}

function groupToJql(group) {
  return group.clauses.map(clauseToJql).join(' ');
}

// Strips a segment's single outermost paren pair, IF that pair spans the
// entire segment (not just a leading sub-expression) — e.g. "(a b)" strips
// to "a b", but "(a b) c" is left alone (that's not a whole-segment wrap).
function unwrapOuterParens(segment) {
  if (segment.length < 2) return segment;
  const first = segment[0];
  const last = segment[segment.length - 1];
  if (!(first.kind === 'paren' && first.value === '(' && last.kind === 'paren' && last.value === ')')) return segment;
  let depth = 0;
  for (let i = 0; i < segment.length; i += 1) {
    const t = segment[i];
    if (t.kind === 'paren' && t.value === '(') depth += 1;
    if (t.kind === 'paren' && t.value === ')') {
      depth -= 1;
      if (depth === 0 && i !== segment.length - 1) return segment; // closes early — not a whole-segment wrap
    }
  }
  return segment.slice(1, -1);
}

// Splits a token stream into segments at top-level (paren-depth 0) OR
// operators, then requires each segment to be a plain AND-sequence of
// field/field-in tokens (optionally wrapped in one redundant paren pair) —
// the only shape a "group" can represent. Returns null the moment anything
// doesn't fit: a bare term, nested/unbalanced parens, or an OR inside a
// group.
function decomposeTokensToGroups(tokens) {
  const segments = [[]];
  let depth = 0;
  for (const t of tokens) {
    if (t.kind === 'paren' && t.value === '(') depth += 1;
    if (t.kind === 'paren' && t.value === ')') depth -= 1;
    if (depth < 0) return null; // stray ')'
    if (t.kind === 'op' && t.op === 'OR' && depth === 0) {
      segments.push([]);
      continue;
    }
    segments[segments.length - 1].push(t);
  }
  if (depth !== 0) return null; // unbalanced parens

  const groups = [];
  let idCounter = 0;
  for (const rawSegment of segments) {
    const segment = unwrapOuterParens(rawSegment);
    if (segment.length === 0) return null;
    if (!segment.every((t) => t.kind === 'field' || t.kind === 'field-in')) return null;
    groups.push({ id: `g${idCounter}`, clauses: segment.map((t) => tokenToClause(t, `c${idCounter++}`)) });
  }
  return groups;
}

// { groups: Group[], advanced: string } — advanced is '' when the whole
// query decomposed cleanly into groups.
export function decomposeQuery(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return { groups: [], advanced: '' };
  const groups = decomposeTokensToGroups(tokenize(trimmed));
  if (groups === null) return { groups: [], advanced: trimmed };
  return { groups, advanced: '' };
}

export function composeQuery(groups, advanced) {
  const nonEmpty = groups.filter((g) => g.clauses.length > 0);
  let groupsPart = '';
  if (nonEmpty.length === 1) {
    groupsPart = groupToJql(nonEmpty[0]);
  } else if (nonEmpty.length > 1) {
    const orExpr = nonEmpty.map((g) => `(${groupToJql(g)})`).join(' OR ');
    // If there's also leading advanced text, wrap the whole OR union in its
    // own parens so it ANDs against the union as a whole, not just the
    // first group (AND binds tighter than OR in this grammar).
    groupsPart = advanced ? `(${orExpr})` : orExpr;
  }
  return [advanced, groupsPart].filter(Boolean).join(' ');
}
