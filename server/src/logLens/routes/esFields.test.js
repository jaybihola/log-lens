import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTempHome } from '../../../test/withTempHome.js';

let ctx;
let fastify;

beforeEach(async () => {
  ctx = await withTempHome();
  const Fastify = (await import('fastify')).default;
  const esFieldRoutes = (await import('./esFields.js')).default;
  const settingsRoutes = (await import('./settings.js')).default;
  const credentialsRoutes = (await import('./credentials.js')).default;
  fastify = Fastify();
  await fastify.register(esFieldRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(credentialsRoutes);
});

afterEach(async () => {
  await fastify.close();
  ctx.cleanup();
  vi.unstubAllGlobals();
});

async function setupEnvironment(overrides = {}) {
  const cred = await fastify.inject({ method: 'POST', url: '/api/credentials', payload: { username: 'bob', password: 'secret' } });
  const credentialId = cred.json().id;
  await fastify.inject({
    method: 'POST',
    url: '/api/settings',
    payload: {
      environments: [{
        name: 'prod',
        url: 'http://es.invalid/_msearch',
        credentialId,
        indices: [{
          pattern: 'logs-*',
          foldFilters: [{ key: 'env', path: 'environment' }],
          ...overrides,
        }],
      }],
    },
  });
}

describe('POST /api/es-query-preview', () => {
  it('returns an error for an unknown environment', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/es-query-preview', payload: { environment: 'nope', queryConfig: {} } });
    expect(res.json()).toEqual({ error: 'invalid environment' });
  });

  it('returns the built request body for a known environment', async () => {
    await setupEnvironment();
    const res = await fastify.inject({ method: 'POST', url: '/api/es-query-preview', payload: { environment: 'prod', queryConfig: { kql: 'level:error' } } });
    const body = res.json().body;
    expect(body.query).toEqual({ bool: { must: [{ match_phrase: { level: 'error' } }] } });
    expect(body.sort).toEqual([{ '@timestamp': { order: 'asc' } }]);
  });

  it('surfaces a KQL parse error as {error} rather than a 500', async () => {
    await setupEnvironment();
    const res = await fastify.inject({ method: 'POST', url: '/api/es-query-preview', payload: { environment: 'prod', queryConfig: { kql: '(bad' } } });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().error).toBe('string');
  });
});

describe('GET /api/es-field-values', () => {
  it('returns 400 for an environment/index/field combination that is not a configured fold filter', async () => {
    await setupEnvironment();
    const res = await fastify.inject({ method: 'GET', url: '/api/es-field-values?environment=prod&index=logs-*&field=nope' });
    expect(res.statusCode).toBe(400);
  });

  it('fetches distinct values via a mocked ES _msearch call', async () => {
    await setupEnvironment();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ responses: [{ aggregations: { vals: { buckets: [{ key: 'prod' }, { key: 'staging' }] } } }] }),
    })));
    const res = await fastify.inject({ method: 'GET', url: '/api/es-field-values?environment=prod&index=logs-*&field=env' });
    expect(res.json()).toEqual({ values: ['prod', 'staging'] });
  });

  it('returns 502 when the ES request fails', async () => {
    await setupEnvironment();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, statusText: 'Internal Error', text: async () => '' })));
    const res = await fastify.inject({ method: 'GET', url: '/api/es-field-values?environment=prod&index=logs-*&field=env' });
    expect(res.statusCode).toBe(502);
  });

  it('caches values for the life of the process — a second call does not re-fetch', async () => {
    await setupEnvironment();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ responses: [{ aggregations: { vals: { buckets: [{ key: 'x' }] } } }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    await fastify.inject({ method: 'GET', url: '/api/es-field-values?environment=prod&index=logs-*&field=env' });
    await fastify.inject({ method: 'GET', url: '/api/es-field-values?environment=prod&index=logs-*&field=env' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/index-fields', () => {
  it('returns 400 for an unknown environment', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/index-fields?environment=nope&index=logs-*' });
    expect(res.statusCode).toBe(400);
  });

  it('returns an empty list for an index nobody has queried yet — never triggers a live ES call', async () => {
    await setupEnvironment();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await fastify.inject({ method: 'GET', url: '/api/index-fields?environment=prod&index=logs-*' });
    expect(res.json()).toEqual({ fields: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
