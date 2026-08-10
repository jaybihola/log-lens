import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempHome } from '../../../test/withTempHome.js';

let ctx;
let fastify;

beforeEach(async () => {
  ctx = await withTempHome();
  const Fastify = (await import('fastify')).default;
  const settingsRoutes = (await import('./settings.js')).default;
  fastify = Fastify();
  await fastify.register(settingsRoutes);
});

afterEach(async () => {
  await fastify.close();
  ctx.cleanup();
});

describe('GET /api/settings', () => {
  it('defaults to an empty environments list when no settings file exists', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/settings' });
    expect(res.json()).toEqual({ environments: [] });
  });
});

describe('POST /api/settings', () => {
  it('normalizes and stores a posted environment', async () => {
    const payload = {
      environments: [{ name: 'prod', url: 'http://es:9200', indices: ['logs-*'] }],
    };
    const res = await fastify.inject({ method: 'POST', url: '/api/settings', payload });
    const body = res.json();
    expect(body.environments).toHaveLength(1);
    expect(body.environments[0]).toMatchObject({ name: 'prod', url: 'http://es:9200' });
    expect(body.environments[0].indices).toEqual([{ pattern: 'logs-*', foldFilters: [], fieldTypeOverrides: {} }]);
  });

  it('drops an environment missing a name or url', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/settings',
      payload: { environments: [{ name: '', url: 'x' }, { name: 'ok', url: 'http://x' }] },
    });
    expect(res.json().environments).toHaveLength(1);
    expect(res.json().environments[0].name).toBe('ok');
  });

  it('a later GET reflects the posted settings (in-memory, for the life of the process)', async () => {
    await fastify.inject({ method: 'POST', url: '/api/settings', payload: { environments: [{ name: 'a', url: 'http://a' }] } });
    const res = await fastify.inject({ method: 'GET', url: '/api/settings' });
    expect(res.json().environments[0].name).toBe('a');
  });

  it('normalizes fold filters and drops incomplete ones', async () => {
    const payload = {
      environments: [{
        name: 'a',
        url: 'http://a',
        indices: [{ pattern: 'logs-*', foldFilters: [{ key: 'env', path: 'environment' }, { key: '', path: 'x' }] }],
      }],
    };
    const res = await fastify.inject({ method: 'POST', url: '/api/settings', payload });
    expect(res.json().environments[0].indices[0].foldFilters).toEqual([
      { key: 'env', label: 'env', path: 'environment', presetValues: [] },
    ]);
  });
});
