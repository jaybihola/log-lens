import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempHome } from '../../../test/withTempHome.js';

let ctx;
let fastify;

beforeEach(async () => {
  // credentials.js seeds one credential from ES_USERNAME/ES_PASSWORD at
  // import time — unset explicitly so a CI environment that happens to
  // export these can't make "starts empty" flaky.
  delete process.env.ES_USERNAME;
  delete process.env.ES_PASSWORD;
  ctx = await withTempHome();
  const Fastify = (await import('fastify')).default;
  const credentialsRoutes = (await import('./credentials.js')).default;
  fastify = Fastify();
  await fastify.register(credentialsRoutes);
});

afterEach(async () => {
  await fastify.close();
  ctx.cleanup();
});

describe('GET /api/credentials', () => {
  it('starts with an empty list when ES_USERNAME is unset', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/credentials' });
    expect(res.json()).toEqual({ credentials: [] });
  });
});

describe('POST /api/credentials', () => {
  it('creates a credential and returns its id', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/credentials', payload: { username: 'bob', password: 'secret' } });
    expect(typeof res.json().id).toBe('string');
  });

  it('defaults the display name to the username when name is omitted', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/credentials', payload: { username: 'bob' } });
    const list = await fastify.inject({ method: 'GET', url: '/api/credentials' });
    expect(list.json().credentials).toEqual([{ id: create.json().id, name: 'bob', username: 'bob' }]);
  });

  it('requires a non-blank username', async () => {
    const empty = await fastify.inject({ method: 'POST', url: '/api/credentials', payload: {} });
    expect(empty.statusCode).toBe(400);
    const blank = await fastify.inject({ method: 'POST', url: '/api/credentials', payload: { username: '   ' } });
    expect(blank.statusCode).toBe(400);
  });

  it('redacts the password from the list response', async () => {
    await fastify.inject({ method: 'POST', url: '/api/credentials', payload: { username: 'bob', password: 'secret' } });
    const list = await fastify.inject({ method: 'GET', url: '/api/credentials' });
    const raw = JSON.stringify(list.json());
    expect(raw).not.toContain('secret');
  });
});

describe('PUT /api/credentials/:id', () => {
  it('updates name/username, leaving the password untouched when omitted', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/credentials', payload: { username: 'bob' } });
    const { id } = create.json();
    const update = await fastify.inject({ method: 'PUT', url: `/api/credentials/${id}`, payload: { username: 'bobby' } });
    expect(update.json()).toEqual({ ok: true });
    const list = await fastify.inject({ method: 'GET', url: '/api/credentials' });
    expect(list.json().credentials[0].username).toBe('bobby');
  });

  it('does not overwrite a saved password with an empty string', async () => {
    const { getCredentialById } = await import('../credentials.js');
    const create = await fastify.inject({ method: 'POST', url: '/api/credentials', payload: { username: 'bob', password: 'secret' } });
    const { id } = create.json();
    await fastify.inject({ method: 'PUT', url: `/api/credentials/${id}`, payload: { password: '' } });
    expect(getCredentialById(id).password).toBe('secret');
  });

  it('returns 404 for a nonexistent credential', async () => {
    const res = await fastify.inject({ method: 'PUT', url: '/api/credentials/nope', payload: { username: 'x' } });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/credentials/:id', () => {
  it('removes a credential', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/credentials', payload: { username: 'bob' } });
    const { id } = create.json();
    const del = await fastify.inject({ method: 'DELETE', url: `/api/credentials/${id}` });
    expect(del.json()).toEqual({ ok: true });
    const list = await fastify.inject({ method: 'GET', url: '/api/credentials' });
    expect(list.json().credentials).toEqual([]);
  });

  it('deleting a nonexistent id is a no-op success, not an error', async () => {
    const res = await fastify.inject({ method: 'DELETE', url: '/api/credentials/nope' });
    expect(res.json()).toEqual({ ok: true });
  });
});
