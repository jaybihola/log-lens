import { describe, expect, it, vi } from 'vitest';

vi.mock('../settings.js', () => ({ getIndexConfig: vi.fn() }));

const { getIndexConfig } = await import('../settings.js');
const { parseKql, buildEsQuery } = await import('./queryBuilder.js');

describe('parseKql', () => {
  it('returns null for an empty/blank query', () => {
    expect(parseKql('')).toBeNull();
    expect(parseKql('   ')).toBeNull();
    expect(parseKql(null)).toBeNull();
  });

  it('builds a match_phrase clause for field:value', () => {
    expect(parseKql('level:error')).toEqual({ match_phrase: { level: 'error' } });
  });

  it('strips quotes from a quoted field value', () => {
    expect(parseKql('message:"hello world"')).toEqual({ match_phrase: { message: 'hello world' } });
  });

  it('builds a query_string clause for a bare term', () => {
    expect(parseKql('error')).toEqual({ query_string: { query: 'error' } });
  });

  it('strips quotes from a quoted bare term', () => {
    expect(parseKql('"hello world"')).toEqual({ query_string: { query: 'hello world' } });
  });

  it('combines implicit-AND terms into a bool.must', () => {
    expect(parseKql('level:error foo')).toEqual({
      bool: { must: [{ match_phrase: { level: 'error' } }, { query_string: { query: 'foo' } }] },
    });
  });

  it('combines explicit AND the same as implicit AND', () => {
    expect(parseKql('a AND b')).toEqual(parseKql('a b'));
  });

  it('builds a bool.should with minimum_should_match:1 for OR', () => {
    expect(parseKql('a OR b')).toEqual({
      bool: { should: [{ query_string: { query: 'a' } }, { query_string: { query: 'b' } }], minimum_should_match: 1 },
    });
  });

  it('gives AND higher precedence than OR', () => {
    const ast = parseKql('a b OR c');
    expect(ast.bool.should[0]).toEqual({ bool: { must: [{ query_string: { query: 'a' } }, { query_string: { query: 'b' } }] } });
    expect(ast.bool.should[1]).toEqual({ query_string: { query: 'c' } });
  });

  it('wraps NOT in a bool.must_not', () => {
    expect(parseKql('NOT error')).toEqual({ bool: { must_not: [{ query_string: { query: 'error' } }] } });
  });

  it('respects parentheses for grouping', () => {
    const withParens = parseKql('a AND (b OR c)');
    expect(withParens.bool.must[1]).toEqual(parseKql('b OR c'));
  });

  it('throws on an unclosed parenthesis', () => {
    expect(() => parseKql('a AND (b')).toThrow(/closing parenthesis/);
  });

  it('throws on a trailing stray token', () => {
    expect(() => parseKql('a )')).toThrow(/trailing token/);
  });
});

describe('buildEsQuery', () => {
  it('returns match_all when there is nothing to filter on', () => {
    getIndexConfig.mockReturnValue(undefined);
    expect(buildEsQuery('env', { index: 'idx', foldValues: {} })).toEqual({ match_all: {} });
  });

  it('adds a date range clause when dateFrom/dateTo are given', () => {
    getIndexConfig.mockReturnValue(undefined);
    const result = buildEsQuery('env', { index: 'idx', dateFrom: '2024-01-01', dateTo: '2024-01-02', foldValues: {} });
    expect(result.bool.must).toEqual([
      { range: { '@timestamp': { gte: new Date('2024-01-01').toISOString(), lte: new Date('2024-01-02').toISOString() } } },
    ]);
  });

  it('adds a fold filter clause for each configured filter with selected values', () => {
    getIndexConfig.mockReturnValue({ foldFilters: [{ key: 'env', path: 'environment' }] });
    const result = buildEsQuery('env', { index: 'idx', foldValues: { env: ['prod'] } });
    expect(result.bool.must).toEqual([{ match_phrase: { environment: 'prod' } }]);
  });

  it('ORs multiple selected values for a single fold filter', () => {
    getIndexConfig.mockReturnValue({ foldFilters: [{ key: 'env', path: 'environment' }] });
    const result = buildEsQuery('env', { index: 'idx', foldValues: { env: ['prod', 'staging'] } });
    expect(result.bool.must[0]).toEqual({
      bool: { should: [{ match_phrase: { environment: 'prod' } }, { match_phrase: { environment: 'staging' } }], minimum_should_match: 1 },
    });
  });

  it('skips a fold filter with no selected values', () => {
    getIndexConfig.mockReturnValue({ foldFilters: [{ key: 'env', path: 'environment' }] });
    const result = buildEsQuery('env', { index: 'idx', foldValues: {} });
    expect(result).toEqual({ match_all: {} });
  });

  it('ANDs the kql clause alongside fold filters and date range', () => {
    getIndexConfig.mockReturnValue({ foldFilters: [{ key: 'env', path: 'environment' }] });
    const result = buildEsQuery('env', {
      index: 'idx', dateFrom: '2024-01-01', foldValues: { env: ['prod'] }, kql: 'level:error',
    });
    expect(result.bool.must).toHaveLength(3);
    expect(result.bool.must[2]).toEqual({ match_phrase: { level: 'error' } });
  });

  it('defaults foldValues to {} when omitted entirely', () => {
    getIndexConfig.mockReturnValue({ foldFilters: [{ key: 'env', path: 'environment' }] });
    expect(() => buildEsQuery('env', { index: 'idx' })).not.toThrow();
    expect(buildEsQuery('env', { index: 'idx' })).toEqual({ match_all: {} });
  });
});
