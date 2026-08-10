import { describe, expect, it } from 'vitest';
import {
  OPERATORS, operatorLabel, operatorArity, clauseToJql, clauseLabel, decomposeQuery, composeQuery,
} from './visualClauses.js';

describe('operatorLabel / operatorArity', () => {
  it('looks up a known operator', () => {
    expect(operatorLabel('is_not')).toBe('is not');
    expect(operatorArity('in')).toBe('many');
    expect(operatorArity('exists')).toBe('none');
  });

  it('falls back to the id/"one" for an unknown operator', () => {
    expect(operatorLabel('bogus')).toBe('bogus');
    expect(operatorArity('bogus')).toBe('one');
  });

  it('every declared operator resolves through OPERATORS', () => {
    for (const op of OPERATORS) {
      expect(operatorLabel(op.id)).toBe(op.label);
      expect(operatorArity(op.id)).toBe(op.arity);
    }
  });
});

describe('clauseToJql', () => {
  it('renders "is" as field:value', () => {
    expect(clauseToJql({ field: 'level', operator: 'is', values: ['error'] })).toBe('level:error');
  });

  it('quotes a value containing whitespace/parens, or an empty value', () => {
    expect(clauseToJql({ field: 'msg', operator: 'is', values: ['hello world'] })).toBe('msg:"hello world"');
    expect(clauseToJql({ field: 'msg', operator: 'is', values: [''] })).toBe('msg:""');
    expect(clauseToJql({ field: 'msg', operator: 'is', values: ['a(b)'] })).toBe('msg:"a(b)"');
  });

  it('does not quote a plain value', () => {
    expect(clauseToJql({ field: 'level', operator: 'is', values: ['error'] })).not.toContain('"');
  });

  it('renders is_not with a leading -', () => {
    expect(clauseToJql({ field: 'level', operator: 'is_not', values: ['error'] })).toBe('-level:error');
  });

  it('renders in/not_in as a parenthesized list, unquoted', () => {
    expect(clauseToJql({ field: 'status', operator: 'in', values: ['ok', 'warn'] })).toBe('status:(ok,warn)');
    expect(clauseToJql({ field: 'status', operator: 'not_in', values: ['ok', 'warn'] })).toBe('-status:(ok,warn)');
  });

  it('renders exists/not_exists/is_null/is_not_null with no value', () => {
    expect(clauseToJql({ field: 'level', operator: 'exists', values: [] })).toBe('level:*');
    expect(clauseToJql({ field: 'level', operator: 'not_exists', values: [] })).toBe('-level:*');
    expect(clauseToJql({ field: 'level', operator: 'is_null', values: [] })).toBe('level:null');
    expect(clauseToJql({ field: 'level', operator: 'is_not_null', values: [] })).toBe('-level:null');
  });

  it('returns an empty string for an unknown operator', () => {
    expect(clauseToJql({ field: 'level', operator: 'bogus', values: [] })).toBe('');
  });
});

describe('clauseLabel', () => {
  it('includes values when present', () => {
    expect(clauseLabel({ field: 'level', operator: 'is', values: ['error'] })).toBe('level is error');
  });

  it('joins multiple values with a comma', () => {
    expect(clauseLabel({ field: 'status', operator: 'in', values: ['ok', 'warn'] })).toBe('status is one of ok, warn');
  });

  it('omits the value list entirely when there are none', () => {
    expect(clauseLabel({ field: 'level', operator: 'exists', values: [] })).toBe('level exists');
  });
});

describe('decomposeQuery', () => {
  it('returns empty groups and no advanced text for a blank query', () => {
    expect(decomposeQuery('')).toEqual({ groups: [], advanced: '' });
    expect(decomposeQuery('   ')).toEqual({ groups: [], advanced: '' });
  });

  it('decomposes a single AND-only group of field clauses with no parens needed', () => {
    const { groups, advanced } = decomposeQuery('level:error status:(ok,warn)');
    expect(advanced).toBe('');
    expect(groups).toHaveLength(1);
    expect(groups[0].clauses).toEqual([
      { id: 'c0', field: 'level', operator: 'is', values: ['error'] },
      { id: 'c1', field: 'status', operator: 'in', values: ['ok', 'warn'] },
    ]);
  });

  it('decomposes an OR of groups, unwrapping each group\'s own paren pair', () => {
    const { groups, advanced } = decomposeQuery('(level:error) OR (level:warn)');
    expect(advanced).toBe('');
    expect(groups.map((g) => g.clauses.map((c) => c.field))).toEqual([['level'], ['level']]);
  });

  it('maps field:* and field:null tokens to exists/is_null clauses', () => {
    const { groups } = decomposeQuery('level:* other:null');
    expect(groups[0].clauses[0]).toMatchObject({ field: 'level', operator: 'exists' });
    expect(groups[0].clauses[1]).toMatchObject({ field: 'other', operator: 'is_null' });
  });

  it('falls back to "advanced" (opaque) when a bare term is present', () => {
    const { groups, advanced } = decomposeQuery('level:error some bare term');
    expect(groups).toEqual([]);
    expect(advanced).toBe('level:error some bare term');
  });

  it('falls back to "advanced" when a group contains a nested OR', () => {
    const { groups, advanced } = decomposeQuery('level:error OR (a OR b)');
    // Second segment after OR is itself "a OR b" once unwrapped, which is
    // not a plain AND-sequence of field tokens -> whole query stays opaque.
    expect(groups).toEqual([]);
    expect(advanced).not.toBe('');
  });

  it('falls back to "advanced" on unbalanced parentheses', () => {
    const { groups, advanced } = decomposeQuery('level:error)');
    expect(groups).toEqual([]);
    expect(advanced).toBe('level:error)');
  });
});

describe('composeQuery', () => {
  it('returns an empty string for no groups and no advanced text', () => {
    expect(composeQuery([], '')).toBe('');
  });

  it('serializes a single group with no wrapping parens', () => {
    const groups = [{ id: 'g0', clauses: [{ id: 'c0', field: 'level', operator: 'is', values: ['error'] }] }];
    expect(composeQuery(groups, '')).toBe('level:error');
  });

  it('serializes multiple groups as a parenthesized OR', () => {
    const groups = [
      { id: 'g0', clauses: [{ id: 'c0', field: 'level', operator: 'is', values: ['error'] }] },
      { id: 'g1', clauses: [{ id: 'c1', field: 'level', operator: 'is', values: ['warn'] }] },
    ];
    expect(composeQuery(groups, '')).toBe('(level:error) OR (level:warn)');
  });

  it('wraps the OR union in its own parens when advanced text is also present', () => {
    const groups = [
      { id: 'g0', clauses: [{ id: 'c0', field: 'level', operator: 'is', values: ['error'] }] },
      { id: 'g1', clauses: [{ id: 'c1', field: 'level', operator: 'is', values: ['warn'] }] },
    ];
    expect(composeQuery(groups, 'foo')).toBe('foo ((level:error) OR (level:warn))');
  });

  it('drops empty groups', () => {
    const groups = [
      { id: 'g0', clauses: [] },
      { id: 'g1', clauses: [{ id: 'c1', field: 'level', operator: 'is', values: ['error'] }] },
    ];
    expect(composeQuery(groups, '')).toBe('level:error');
  });

  it('round-trips through decomposeQuery for a decomposable query', () => {
    const original = 'level:error status:(ok,warn)';
    const { groups, advanced } = decomposeQuery(original);
    expect(composeQuery(groups, advanced)).toBe(original);
  });
});
