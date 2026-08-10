import { describe, expect, it } from 'vitest';
import {
  findBalancedJson, tryParseJsonObject, resolveJsonObject, splitKeyPath,
  getColumnValue, isColumnValueObject, jsonPathRawValue, jsonPathValue,
} from './jsonPaths.js';

describe('findBalancedJson', () => {
  it('finds a simple balanced object', () => {
    expect(findBalancedJson('{"a":1}', 0)).toBe('{"a":1}');
  });

  it('finds a balanced object embedded in surrounding text', () => {
    const text = 'prefix {"a":1} suffix';
    expect(findBalancedJson(text, text.indexOf('{'))).toBe('{"a":1}');
  });

  it('respects quoted strings containing braces', () => {
    const text = '{"a":"} not a close"}';
    expect(findBalancedJson(text, 0)).toBe(text);
  });

  it('respects escaped quotes inside strings', () => {
    const text = '{"a":"esc\\"aped"}';
    expect(findBalancedJson(text, 0)).toBe(text);
  });

  it('returns null for an unbalanced/unterminated structure', () => {
    expect(findBalancedJson('{"a":1', 0)).toBeNull();
  });

  it('returns null when close bracket type mismatches open', () => {
    expect(findBalancedJson('{"a":1]', 0)).toBeNull();
  });

  it('finds a balanced array', () => {
    expect(findBalancedJson('[1,2,3]', 0)).toBe('[1,2,3]');
  });
});

describe('tryParseJsonObject', () => {
  it('parses a leading-brace object', () => {
    expect(tryParseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('tolerates leading whitespace', () => {
    expect(tryParseJsonObject('   {"a":1}')).toEqual({ a: 1 });
  });

  it('returns null for text not starting with {', () => {
    expect(tryParseJsonObject('[1,2]')).toBeNull();
    expect(tryParseJsonObject('plain text')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(tryParseJsonObject('{bad}')).toBeNull();
  });
});

describe('resolveJsonObject', () => {
  it('parses the whole text when it is pure JSON', () => {
    expect(resolveJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('falls back to parsing one physical line as JSON', () => {
    const text = 'a plain header\n{"a":1}\nmore text';
    expect(resolveJsonObject(text)).toEqual({ a: 1 });
  });

  it('falls back to scanning for an embedded {...} object', () => {
    const text = 'Category[0] Something happened: {"a":1} and then more';
    expect(resolveJsonObject(text)).toEqual({ a: 1 });
  });

  it('does not false-match a bracketed array-looking substring like Category[0]', () => {
    expect(resolveJsonObject('Category[0] no json here')).toBeNull();
  });

  it('returns null when nothing resolves', () => {
    expect(resolveJsonObject('just plain text')).toBeNull();
  });
});

describe('splitKeyPath', () => {
  it('splits a dot path', () => {
    expect(splitKeyPath('a.b.c')).toEqual(['a', 'b', 'c']);
  });

  it('splits bracket array indices into their own numeric segments', () => {
    expect(splitKeyPath('Tags[0].Name')).toEqual(['Tags', '0', 'Name']);
  });

  it('filters out empty segments', () => {
    expect(splitKeyPath('a..b')).toEqual(['a', 'b']);
    expect(splitKeyPath('')).toEqual([]);
  });
});

describe('jsonPathRawValue', () => {
  it('distinguishes a missing field from a present-but-null one', () => {
    expect(jsonPathRawValue('{"a":null}', 'a')).toEqual({ present: true, raw: null });
    expect(jsonPathRawValue('{"b":1}', 'a')).toEqual({ present: false, raw: undefined });
  });

  it('resolves a nested dot path', () => {
    expect(jsonPathRawValue('{"a":{"b":{"c":5}}}', 'a.b.c')).toEqual({ present: true, raw: 5 });
  });

  it('resolves through an array index', () => {
    expect(jsonPathRawValue('{"Tags":[{"Name":"x"}]}', 'Tags[0].Name')).toEqual({ present: true, raw: 'x' });
  });

  it('reports absent when a path segment does not exist partway through', () => {
    expect(jsonPathRawValue('{"a":{"b":1}}', 'a.z.c')).toEqual({ present: false, raw: undefined });
  });

  it('reports absent for non-JSON text', () => {
    expect(jsonPathRawValue('plain text', 'a')).toEqual({ present: false, raw: undefined });
  });
});

describe('jsonPathValue', () => {
  it('stringifies a present scalar', () => {
    expect(jsonPathValue('{"a":1}', 'a')).toEqual({ present: true, value: '1' });
  });

  it('stringifies a present object/array value with JSON.stringify', () => {
    expect(jsonPathValue('{"a":{"b":1}}', 'a')).toEqual({ present: true, value: '{"b":1}' });
  });

  it('reports an empty value string for a present-but-null field', () => {
    expect(jsonPathValue('{"a":null}', 'a')).toEqual({ present: true, value: '' });
  });

  it('reports absent for a missing field', () => {
    expect(jsonPathValue('{"b":1}', 'a')).toEqual({ present: false, value: '' });
  });
});

describe('getColumnValue / isColumnValueObject', () => {
  it('returns the stringified scalar for a present field', () => {
    expect(getColumnValue('{"a":1}', 'a')).toBe('1');
    expect(isColumnValueObject('{"a":1}', 'a')).toBe(false);
  });

  it('returns "" for a missing or null field', () => {
    expect(getColumnValue('{"a":null}', 'a')).toBe('');
    expect(getColumnValue('{"b":1}', 'a')).toBe('');
  });

  it('JSON.stringifies an object/array value and flags it as an object', () => {
    expect(getColumnValue('{"a":{"b":1}}', 'a')).toBe('{"b":1}');
    expect(isColumnValueObject('{"a":{"b":1}}', 'a')).toBe(true);
    expect(getColumnValue('{"a":[1,2]}', 'a')).toBe('[1,2]');
    expect(isColumnValueObject('{"a":[1,2]}', 'a')).toBe(true);
  });

  it('isColumnValueObject is false for a missing/null field', () => {
    expect(isColumnValueObject('{"a":null}', 'a')).toBe(false);
    expect(isColumnValueObject('{"b":1}', 'a')).toBe(false);
  });
});
