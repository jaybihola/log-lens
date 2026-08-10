import { describe, expect, it } from 'vitest';
import {
  locateJsonError, validateJson, escapeJsonString, unescapeJsonString,
  sortJsonKeysDeep, formatJsonText, minifyJsonText, fuzzyMatchKey,
  collectDistinctKeys, findMatchingFieldNames, filterJsonByFields,
  getJsonValueType, jsonValuePreview, parseJsonForTable, formatScalarText,
  jsonChildEntries, findTextOccurrences, jsonPathKey, jsonMatchKey, findJsonMatches,
} from './jsonUtils.js';

describe('locateJsonError', () => {
  it('returns null for empty/whitespace-only text', () => {
    expect(locateJsonError('')).toBeNull();
    expect(locateJsonError('   \n  ')).toBeNull();
  });

  it('returns null for valid JSON', () => {
    expect(locateJsonError('{"a":1}')).toBeNull();
  });

  it('locates a position-based error', () => {
    const result = locateJsonError('{"a":1,}');
    expect(result).not.toBeNull();
    expect(typeof result.pos).toBe('number');
  });
});

describe('validateJson', () => {
  it('treats empty text as valid', () => {
    expect(validateJson('')).toEqual({ valid: true, error: null });
  });

  it('accepts valid JSON', () => {
    expect(validateJson('{"a":1}')).toEqual({ valid: true, error: null });
  });

  it('reports invalid JSON with an error message', () => {
    const result = validateJson('{invalid}');
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('appends a (line, col) suffix when the engine error has a position but no line/col', () => {
    const result = validateJson('{\n"a":1,\n}');
    expect(result.valid).toBe(false);
    // Only assert the suffix shape when the engine's own message used
    // "position N" (V8 does) — some engines already report line/column and
    // shouldn't get a duplicate suffix.
    if (/position \d+/i.test(result.error) === false) {
      expect(result.error).toMatch(/\(line \d+, col \d+\)$/);
    }
  });
});

describe('escapeJsonString / unescapeJsonString', () => {
  it('round-trips arbitrary text', () => {
    const original = '{"a":1}\nwith "quotes" and \\backslash';
    const escaped = escapeJsonString(original);
    expect(unescapeJsonString(escaped)).toBe(original);
  });

  it('escapeJsonString never throws', () => {
    expect(() => escapeJsonString('')).not.toThrow();
    expect(escapeJsonString('a')).toBe('"a"');
  });

  it('unescapeJsonString throws on non-string JSON', () => {
    expect(() => unescapeJsonString('42')).toThrow('Not a JSON-encoded string');
    expect(() => unescapeJsonString('{"a":1}')).toThrow('Not a JSON-encoded string');
  });

  it('unescapeJsonString throws on non-JSON input', () => {
    expect(() => unescapeJsonString('not json')).toThrow();
  });
});

describe('sortJsonKeysDeep', () => {
  it('sorts object keys alphabetically at every depth', () => {
    const input = { b: 1, a: { d: 1, c: 2 } };
    expect(sortJsonKeysDeep(input)).toEqual({ a: { c: 2, d: 1 }, b: 1 });
    expect(Object.keys(sortJsonKeysDeep(input))).toEqual(['a', 'b']);
  });

  it('recurses into arrays without sorting array order itself', () => {
    const input = [{ b: 1, a: 2 }, { z: 1, y: 2 }];
    const sorted = sortJsonKeysDeep(input);
    expect(Object.keys(sorted[0])).toEqual(['a', 'b']);
    expect(Object.keys(sorted[1])).toEqual(['y', 'z']);
  });

  it('passes primitives through unchanged', () => {
    expect(sortJsonKeysDeep(42)).toBe(42);
    expect(sortJsonKeysDeep(null)).toBeNull();
    expect(sortJsonKeysDeep('x')).toBe('x');
  });
});

describe('formatJsonText / minifyJsonText', () => {
  it('formats with the given numeric indent', () => {
    expect(formatJsonText('{"a":1}', { indent: 2 })).toBe('{\n  "a": 1\n}');
  });

  it('formats with tab indent', () => {
    expect(formatJsonText('{"a":1}', { indent: 'tab' })).toBe('{\n\t"a": 1\n}');
  });

  it('sorts keys when sortKeys is true', () => {
    expect(formatJsonText('{"b":1,"a":2}', { indent: 2, sortKeys: true })).toBe('{\n  "a": 2,\n  "b": 1\n}');
  });

  it('minifies to a single line', () => {
    expect(minifyJsonText('{\n  "a": 1\n}')).toBe('{"a":1}');
  });

  it('minifies with sortKeys', () => {
    expect(minifyJsonText('{"b":1,"a":2}', { sortKeys: true })).toBe('{"a":2,"b":1}');
  });

  it('throws on invalid JSON', () => {
    expect(() => formatJsonText('{bad}')).toThrow();
    expect(() => minifyJsonText('{bad}')).toThrow();
  });
});

describe('fuzzyMatchKey', () => {
  it('matches an empty query against anything', () => {
    expect(fuzzyMatchKey('', 'anything')).toBe(true);
  });

  it('matches an ordered, case-insensitive subsequence', () => {
    expect(fuzzyMatchKey('usr', 'userName')).toBe(true);
    expect(fuzzyMatchKey('USR', 'userName')).toBe(true);
  });

  it('rejects out-of-order or missing characters', () => {
    expect(fuzzyMatchKey('rsu', 'userName')).toBe(false);
    expect(fuzzyMatchKey('zzz', 'userName')).toBe(false);
  });

  it('rejects a query longer than any possible subsequence', () => {
    expect(fuzzyMatchKey('username!', 'userName')).toBe(false);
  });
});

describe('collectDistinctKeys', () => {
  it('collects keys at every depth, including inside arrays', () => {
    const keys = collectDistinctKeys({ a: 1, b: [{ c: 2 }, { d: 3 }] });
    expect([...keys].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('deduplicates repeated key names', () => {
    const keys = collectDistinctKeys([{ a: 1 }, { a: 2 }]);
    expect([...keys]).toEqual(['a']);
  });

  it('returns an empty set for scalars', () => {
    expect(collectDistinctKeys(42).size).toBe(0);
    expect(collectDistinctKeys(null).size).toBe(0);
  });
});

describe('findMatchingFieldNames', () => {
  it('returns a parse error for invalid JSON', () => {
    const result = findMatchingFieldNames('{bad}', 'a');
    expect(result.ok).toBe(false);
    expect(result.names).toEqual([]);
  });

  it('returns no names for a blank query', () => {
    const result = findMatchingFieldNames('{"userName":1}', '  ');
    expect(result).toEqual({ ok: true, error: null, names: [] });
  });

  it('returns sorted fuzzy matches', () => {
    const result = findMatchingFieldNames('{"userName":1,"userId":2,"other":3}', 'usr');
    expect(result.ok).toBe(true);
    expect(result.names).toEqual(['userId', 'userName']);
  });
});

describe('filterJsonByFields', () => {
  const doc = JSON.stringify({ a: 1, b: { c: 2, d: 3 }, e: [{ c: 9 }, { f: 1 }] });

  it('returns a parse error for invalid JSON', () => {
    const result = filterJsonByFields('{bad}', ['a']);
    expect(result.ok).toBe(false);
    expect(result.matched).toBe(false);
  });

  it('reports no match for an empty field list', () => {
    expect(filterJsonByFields(doc, [])).toEqual({ ok: true, error: null, resultText: '', matched: false });
  });

  it('keeps a matched key and its entire subtree unpruned', () => {
    const result = filterJsonByFields(doc, ['b']);
    expect(result.matched).toBe(true);
    expect(JSON.parse(result.resultText)).toEqual({ b: { c: 2, d: 3 } });
  });

  it('keeps ancestor keys needed to reach a nested match, pruning siblings', () => {
    // "c" only exists nested under "b" and inside one element of "e" —
    // ancestors should survive, but "d" (a sibling of the matched "c") and
    // the non-matching array element should not.
    const result = filterJsonByFields(doc, ['c']);
    expect(result.matched).toBe(true);
    expect(JSON.parse(result.resultText)).toEqual({ b: { c: 2 }, e: [{ c: 9 }] });
  });

  it('reports no match when the field name occurs nowhere', () => {
    const result = filterJsonByFields(doc, ['nope']);
    expect(result).toEqual({ ok: true, error: null, resultText: '', matched: false });
  });

  it('respects tab indent', () => {
    const result = filterJsonByFields('{"a":1}', ['a'], { indent: 'tab' });
    expect(result.resultText).toBe('{\n\t"a": 1\n}');
  });
});

describe('getJsonValueType', () => {
  it('distinguishes null, array, and object from plain typeof', () => {
    expect(getJsonValueType(null)).toBe('null');
    expect(getJsonValueType([1, 2])).toBe('array');
    expect(getJsonValueType({})).toBe('object');
    expect(getJsonValueType('s')).toBe('string');
    expect(getJsonValueType(1)).toBe('number');
    expect(getJsonValueType(true)).toBe('boolean');
  });
});

describe('jsonValuePreview', () => {
  it('pluralizes array item counts correctly', () => {
    expect(jsonValuePreview([1])).toBe('[1 item]');
    expect(jsonValuePreview([1, 2])).toBe('[2 items]');
    expect(jsonValuePreview([])).toBe('[0 items]');
  });

  it('pluralizes object key counts correctly', () => {
    expect(jsonValuePreview({ a: 1 })).toBe('{1 key}');
    expect(jsonValuePreview({ a: 1, b: 2 })).toBe('{2 keys}');
  });

  it('stringifies scalars directly', () => {
    expect(jsonValuePreview(42)).toBe('42');
    expect(jsonValuePreview(true)).toBe('true');
  });
});

describe('parseJsonForTable', () => {
  it('treats empty text as ok with an undefined value', () => {
    expect(parseJsonForTable('')).toEqual({ ok: true, value: undefined });
  });

  it('parses valid JSON', () => {
    expect(parseJsonForTable('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('reports a parse error', () => {
    const result = parseJsonForTable('{bad}');
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

describe('formatScalarText', () => {
  it('quotes strings, lowercases null, stringifies everything else', () => {
    expect(formatScalarText('hi', 'string')).toBe('"hi"');
    expect(formatScalarText(null, 'null')).toBe('null');
    expect(formatScalarText(42, 'number')).toBe('42');
    expect(formatScalarText(false, 'boolean')).toBe('false');
  });
});

describe('jsonChildEntries', () => {
  it('maps array items to index-based entries with bracket display keys', () => {
    expect(jsonChildEntries(['x', 'y'])).toEqual([
      { rawKey: 0, displayKey: '[0]', value: 'x' },
      { rawKey: 1, displayKey: '[1]', value: 'y' },
    ]);
  });

  it('maps object entries to key-based entries', () => {
    expect(jsonChildEntries({ a: 1 })).toEqual([{ rawKey: 'a', displayKey: 'a', value: 1 }]);
  });

  it('returns an empty array for scalars', () => {
    expect(jsonChildEntries(42)).toEqual([]);
    expect(jsonChildEntries(null)).toEqual([]);
  });
});

describe('findTextOccurrences', () => {
  it('finds every non-overlapping occurrence', () => {
    expect(findTextOccurrences('abcabc', 'abc')).toEqual([{ from: 0, to: 3 }, { from: 3, to: 6 }]);
  });

  it('does not double-count overlapping occurrences', () => {
    expect(findTextOccurrences('aaaa', 'aa')).toEqual([{ from: 0, to: 2 }, { from: 2, to: 4 }]);
  });

  it('is case-insensitive by default and case-sensitive when asked', () => {
    expect(findTextOccurrences('Hello hello', 'hello', false)).toHaveLength(2);
    expect(findTextOccurrences('Hello hello', 'hello', true)).toEqual([{ from: 6, to: 11 }]);
  });

  it('returns an empty array for empty text or query', () => {
    expect(findTextOccurrences('', 'x')).toEqual([]);
    expect(findTextOccurrences('x', '')).toEqual([]);
  });
});

describe('jsonPathKey / jsonMatchKey', () => {
  it('produces a stable JSON-encoded key for a path', () => {
    expect(jsonPathKey(['a', 0, 'b'])).toBe(JSON.stringify(['a', 0, 'b']));
  });

  it('combines path key and field into one match key', () => {
    expect(jsonMatchKey({ path: ['a'], field: 'value' })).toBe(`${JSON.stringify(['a'])}|value`);
  });
});

describe('findJsonMatches', () => {
  it('returns no matches for a blank query', () => {
    expect(findJsonMatches({ a: 1 }, '  ', false)).toEqual([]);
  });

  it('returns no matches for an undefined document', () => {
    expect(findJsonMatches(undefined, 'a', false)).toEqual([]);
  });

  it('matches a key name', () => {
    const matches = findJsonMatches({ userName: 'x' }, 'user', false);
    expect(matches).toEqual([{ path: ['userName'], field: 'key' }]);
  });

  it('matches a scalar value using the same text the table renders', () => {
    const matches = findJsonMatches({ a: 'hello' }, 'hello', false);
    expect(matches).toEqual([{ path: ['a'], field: 'value' }]);
  });

  it('recurses into nested objects and arrays, building the full path', () => {
    const matches = findJsonMatches({ a: [{ b: 'target' }] }, 'target', false);
    expect(matches).toEqual([{ path: ['a', 0, 'b'], field: 'value' }]);
  });

  it('matches a bare scalar document at the root path', () => {
    expect(findJsonMatches('hello world', 'world', false)).toEqual([{ path: [], field: 'value' }]);
  });

  it('is case-insensitive by default and case-sensitive when asked', () => {
    expect(findJsonMatches({ a: 'Hello' }, 'hello', false)).toHaveLength(1);
    expect(findJsonMatches({ a: 'Hello' }, 'hello', true)).toHaveLength(0);
  });

  it('produces one match per node, not one per in-text occurrence', () => {
    const matches = findJsonMatches({ a: 'aa aa' }, 'aa', false);
    expect(matches).toEqual([{ path: ['a'], field: 'value' }]);
  });
});
