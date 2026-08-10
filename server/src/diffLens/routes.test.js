import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempHome } from '../../test/withTempHome.js';
import fs from 'node:fs';
import path from 'node:path';

let ctx;
let fastify;

beforeEach(async () => {
  ctx = await withTempHome();
  const Fastify = (await import('fastify')).default;
  const diffLensRoutes = (await import('./routes.js')).default;
  fastify = Fastify();
  await fastify.register(diffLensRoutes);
});

afterEach(async () => {
  await fastify.close();
  ctx.cleanup();
});

describe('scratch routes', () => {
  it('starts with an empty scratch list', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/diff-lens/scratches' });
    expect(res.json()).toEqual({ scratches: [] });
  });

  it('creates a scratch, defaulting the name to Untitled', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/diff-lens/scratches',
      payload: { leftText: 'a', rightText: 'b', language: 'plaintext', options: {} },
    });
    const body = res.json();
    expect(body.name).toBe('Untitled');
    expect(typeof body.id).toBe('string');
  });

  it('GET by id returns the full structured payload directly, not wrapped in {content}', async () => {
    const create = await fastify.inject({
      method: 'POST',
      url: '/api/diff-lens/scratches',
      payload: { name: 'cmp', leftText: 'left', rightText: 'right', language: 'javascript', options: { ignoreCase: true } },
    });
    const { id } = create.json();
    const read = await fastify.inject({ method: 'GET', url: `/api/diff-lens/scratches/${id}` });
    expect(read.json()).toEqual({ leftText: 'left', rightText: 'right', language: 'javascript', options: { ignoreCase: true } });
  });

  it('returns 404 for a scratch id that does not exist', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/diff-lens/scratches/nope' });
    expect(res.statusCode).toBe(404);
  });

  it('updates only the given fields via PUT, leaving the rest untouched', async () => {
    const create = await fastify.inject({
      method: 'POST',
      url: '/api/diff-lens/scratches',
      payload: { name: 'cmp', leftText: 'left', rightText: 'right', language: 'plaintext', options: {} },
    });
    const { id } = create.json();
    await fastify.inject({ method: 'PUT', url: `/api/diff-lens/scratches/${id}`, payload: { rightText: 'changed' } });
    const read = await fastify.inject({ method: 'GET', url: `/api/diff-lens/scratches/${id}` });
    expect(read.json()).toEqual({ leftText: 'left', rightText: 'changed', language: 'plaintext', options: {} });
  });

  it('renaming via PUT does not touch the stored leftText/rightText/language/options', async () => {
    const create = await fastify.inject({
      method: 'POST',
      url: '/api/diff-lens/scratches',
      payload: { name: 'cmp', leftText: 'left', rightText: 'right', language: 'python', options: {} },
    });
    const { id } = create.json();
    const rename = await fastify.inject({ method: 'PUT', url: `/api/diff-lens/scratches/${id}`, payload: { name: 'renamed' } });
    expect(rename.json().name).toBe('renamed');
    const read = await fastify.inject({ method: 'GET', url: `/api/diff-lens/scratches/${id}` });
    expect(read.json()).toEqual({ leftText: 'left', rightText: 'right', language: 'python', options: {} });
  });

  it('returns 404 when updating a nonexistent scratch', async () => {
    const res = await fastify.inject({ method: 'PUT', url: '/api/diff-lens/scratches/nope', payload: { name: 'x' } });
    expect(res.statusCode).toBe(404);
  });

  it('deletes a scratch', async () => {
    const create = await fastify.inject({
      method: 'POST',
      url: '/api/diff-lens/scratches',
      payload: { name: 'a', leftText: '', rightText: '', language: 'plaintext', options: {} },
    });
    const { id } = create.json();
    const del = await fastify.inject({ method: 'DELETE', url: `/api/diff-lens/scratches/${id}` });
    expect(del.json()).toEqual({ ok: true });
    const list = await fastify.inject({ method: 'GET', url: '/api/diff-lens/scratches' });
    expect(list.json()).toEqual({ scratches: [] });
  });

  it('persists scratches under a diff-lens-specific scratches directory, separate from JSON Lens', async () => {
    await fastify.inject({
      method: 'POST',
      url: '/api/diff-lens/scratches',
      payload: { name: 'a', leftText: '', rightText: '', language: 'plaintext', options: {} },
    });
    expect(fs.existsSync(path.join(ctx.dir, '.log-lens-diff-scratches'))).toBe(true);
    expect(fs.existsSync(path.join(ctx.dir, '.log-lens-scratches'))).toBe(false);
  });
});
