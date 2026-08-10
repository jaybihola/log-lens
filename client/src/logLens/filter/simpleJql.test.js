import { describe, expect, it } from 'vitest';
import { tokenize, parseSimpleAst, buildSimpleMatcher, highlightTermsForSimple } from './simpleJql.js';

describe('tokenize', () => {
  it('tokenizes a bare word as a term', () => {
    expect(tokenize('error')).toEqual([{ kind: 'term', text: 'error', negate: false }]);
  });

  it('tokenizes a negated bare word', () => {
    expect(tokenize('-error')).toEqual([{ kind: 'term', text: 'error', negate: true }]);
  });

  it('treats "OR" case-insensitively as an operator', () => {
    expect(tokenize('a or b')).toEqual([
      { kind: 'term', text: 'a', negate: false },
      { kind: 'op', op: 'OR' },
      { kind: 'term', text: 'b', negate: false },
    ]);
    expect(tokenize('a OR b')).toHaveLength(3);
  });

  it('drops explicit "and" as implicit', () => {
    expect(tokenize('a and b')).toEqual([
      { kind: 'term', text: 'a', negate: false },
      { kind: 'term', text: 'b', negate: false },
    ]);
  });

  it('tokenizes field:value', () => {
    expect(tokenize('level:error')).toEqual([{ kind: 'field', field: 'level', value: 'error', negate: false }]);
  });

  it('tokenizes negated field:value', () => {
    expect(tokenize('-level:error')).toEqual([{ kind: 'field', field: 'level', value: 'error', negate: true }]);
  });

  it('tokenizes field:"quoted value"', () => {
    expect(tokenize('message:"hello world"')).toEqual([{ kind: 'field', field: 'message', value: 'hello world', negate: false }]);
  });

  it('tokenizes "quoted field":value', () => {
    expect(tokenize('"my field":value')).toEqual([{ kind: 'field', field: 'my field', value: 'value', negate: false }]);
  });

  it('tokenizes field:(v1,v2,v3) as field-in, trimming values', () => {
    expect(tokenize('status:(ok, warn ,err)')).toEqual([
      { kind: 'field-in', field: 'status', values: ['ok', 'warn', 'err'], negate: false },
    ]);
  });

  it('tokenizes a negated field-in', () => {
    expect(tokenize('-status:(ok,warn)')).toEqual([
      { kind: 'field-in', field: 'status', values: ['ok', 'warn'], negate: true },
    ]);
  });

  it('tokenizes a quoted phrase as a term', () => {
    expect(tokenize('"hello world"')).toEqual([{ kind: 'term', text: 'hello world', negate: false }]);
  });

  it('tokenizes standalone parens', () => {
    expect(tokenize('(a b)')).toEqual([
      { kind: 'paren', value: '(' },
      { kind: 'term', text: 'a', negate: false },
      { kind: 'term', text: 'b', negate: false },
      { kind: 'paren', value: ')' },
    ]);
  });

  it('tokenizes field:* presence check', () => {
    expect(tokenize('level:*')).toEqual([{ kind: 'field', field: 'level', value: '*', negate: false }]);
  });

  it('tokenizes multiple space-separated terms as implicit AND', () => {
    expect(tokenize('foo bar')).toEqual([
      { kind: 'term', text: 'foo', negate: false },
      { kind: 'term', text: 'bar', negate: false },
    ]);
  });
});

describe('parseSimpleAst', () => {
  it('returns null for an empty token list', () => {
    expect(parseSimpleAst([])).toBeNull();
  });

  it('builds an AND chain for adjacent atoms', () => {
    const ast = parseSimpleAst(tokenize('a b c'));
    expect(ast.type).toBe('AND');
    expect(ast.left.type).toBe('AND');
    expect(ast.right.token.text).toBe('c');
  });

  it('gives OR lower precedence than implicit AND', () => {
    const ast = parseSimpleAst(tokenize('a b OR c'));
    expect(ast.type).toBe('OR');
    expect(ast.left.type).toBe('AND'); // "a b" grouped together on the left of OR
    expect(ast.right.type).toBe('LEAF');
  });

  it('respects parentheses for grouping', () => {
    const ast = parseSimpleAst(tokenize('a (b OR c)'));
    expect(ast.type).toBe('AND');
    expect(ast.right.type).toBe('OR');
  });

  it('throws on an unclosed paren', () => {
    expect(() => parseSimpleAst(tokenize('a AND (b'))).toThrow(/Missing closing/);
  });

  it('throws on a stray closing paren', () => {
    expect(() => parseSimpleAst([{ kind: 'paren', value: ')' }])).toThrow(/Unexpected \)/);
  });

  it('filters out empty term tokens before parsing', () => {
    // A defensive case: an empty-text term (shouldn't normally come out of
    // tokenize, but the filter exists deliberately) is dropped rather than
    // breaking the parse.
    const ast = parseSimpleAst([{ kind: 'term', text: '', negate: false }, { kind: 'term', text: 'a', negate: false }]);
    expect(ast).toEqual({ type: 'LEAF', token: { kind: 'term', text: 'a', negate: false } });
  });
});

describe('buildSimpleMatcher', () => {
  it('matches everything for an empty query', () => {
    const m = buildSimpleMatcher('', false);
    expect(m('anything')).toBe(true);
    expect(m('')).toBe(true);
  });

  it('matches a plain substring term, case-insensitively by default', () => {
    const m = buildSimpleMatcher('error', false);
    expect(m('an ERROR occurred')).toBe(true);
    expect(m('all good')).toBe(false);
  });

  it('respects case-sensitivity', () => {
    const m = buildSimpleMatcher('Error', true);
    expect(m('an Error occurred')).toBe(true);
    expect(m('an error occurred')).toBe(false);
  });

  it('negates a term', () => {
    const m = buildSimpleMatcher('-error', false);
    expect(m('all good')).toBe(true);
    expect(m('an error occurred')).toBe(false);
  });

  it('implicit AND requires every term', () => {
    const m = buildSimpleMatcher('foo bar', false);
    expect(m('foo and bar here')).toBe(true);
    expect(m('only foo here')).toBe(false);
  });

  it('OR requires at least one side', () => {
    const m = buildSimpleMatcher('foo OR bar', false);
    expect(m('has foo')).toBe(true);
    expect(m('has bar')).toBe(true);
    expect(m('has neither')).toBe(false);
  });

  it('supports wildcard terms, unanchored', () => {
    const m = buildSimpleMatcher('err*', false);
    expect(m('an error occurred')).toBe(true);
    expect(m('nothing here')).toBe(false);
  });

  it('matches field:value as a substring on the field, JSON entries', () => {
    const m = buildSimpleMatcher('level:err', false);
    expect(m('{"level":"error"}')).toBe(true);
    expect(m('{"level":"info"}')).toBe(false);
  });

  it('field:* means "field present" regardless of value, including null', () => {
    const m = buildSimpleMatcher('level:*', false);
    expect(m('{"level":"error"}')).toBe(true);
    expect(m('{"level":null}')).toBe(true);
    expect(m('{"other":1}')).toBe(false);
  });

  it('field:null means present AND value is exactly null', () => {
    const m = buildSimpleMatcher('level:null', false);
    expect(m('{"level":null}')).toBe(true);
    expect(m('{"level":"error"}')).toBe(false);
    expect(m('{"other":1}')).toBe(false);
  });

  it('-field:* means field does not exist at all', () => {
    const m = buildSimpleMatcher('-level:*', false);
    expect(m('{"other":1}')).toBe(true);
    expect(m('{"level":null}')).toBe(false);
  });

  it('field:(v1,v2) matches any of the listed values', () => {
    const m = buildSimpleMatcher('status:(ok,warn)', false);
    expect(m('{"status":"ok"}')).toBe(true);
    expect(m('{"status":"warn"}')).toBe(true);
    expect(m('{"status":"error"}')).toBe(false);
  });

  it('supports a wildcard field value anchored against the whole value', () => {
    const m = buildSimpleMatcher('level:err*', false);
    expect(m('{"level":"error"}')).toBe(true);
    expect(m('{"level":"an error"}')).toBe(false); // anchored, not "contains"
  });

  it('throws on malformed parentheses so callers can surface a parse error', () => {
    expect(() => buildSimpleMatcher('(a', false)).toThrow();
  });
});

describe('highlightTermsForSimple', () => {
  it('collects non-negated bare terms', () => {
    expect(highlightTermsForSimple('foo bar')).toEqual(['foo', 'bar']);
  });

  it('excludes negated terms', () => {
    expect(highlightTermsForSimple('foo -bar')).toEqual(['foo']);
  });

  it('includes a field value, but not "*" or "null" sentinels', () => {
    expect(highlightTermsForSimple('level:error')).toEqual(['error']);
    expect(highlightTermsForSimple('level:*')).toEqual([]);
    expect(highlightTermsForSimple('level:null')).toEqual([]);
  });

  it('includes every real value from a field-in list, excluding sentinels', () => {
    expect(highlightTermsForSimple('status:(ok,warn,null)')).toEqual(['ok', 'warn']);
  });

  it('returns an empty array for an empty query', () => {
    expect(highlightTermsForSimple('')).toEqual([]);
  });
});
