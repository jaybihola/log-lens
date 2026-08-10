import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempHome } from '../../test/withTempHome.js';
import fs from 'node:fs';
import path from 'node:path';

let ctx;
let fastify;

beforeEach(async () => {
  ctx = await withTempHome();
  const Fastify = (await import('fastify')).default;
  const jsonLensRoutes = (await import('./routes.js')).default;
  fastify = Fastify();
  await fastify.register(jsonLensRoutes);
});

afterEach(async () => {
  await fastify.close();
  ctx.cleanup();
});

describe('roots routes', () => {
  it('starts with an empty root list', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/json-lens/roots' });
    expect(res.json()).toEqual({ roots: [] });
  });

  it('adds a root that exists and is a directory', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/json-lens/roots', payload: { path: ctx.dir } });
    expect(res.json()).toEqual({ roots: [ctx.dir] });
    const list = await fastify.inject({ method: 'GET', url: '/api/json-lens/roots' });
    expect(list.json()).toEqual({ roots: [ctx.dir] });
  });

  it('rejects a root path that is not a directory', async () => {
    const filePath = path.join(ctx.dir, 'a-file.txt');
    fs.writeFileSync(filePath, 'x');
    const res = await fastify.inject({ method: 'POST', url: '/api/json-lens/roots', payload: { path: filePath } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a root path that does not exist', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/json-lens/roots', payload: { path: path.join(ctx.dir, 'nope') } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an empty path', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/json-lens/roots', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('removes a root', async () => {
    await fastify.inject({ method: 'POST', url: '/api/json-lens/roots', payload: { path: ctx.dir } });
    const res = await fastify.inject({ method: 'DELETE', url: '/api/json-lens/roots', payload: { path: ctx.dir } });
    expect(res.json()).toEqual({ roots: [] });
  });
});

describe('browse route', () => {
  it('lists .json files and all directories, filtering out other file types', async () => {
    fs.writeFileSync(path.join(ctx.dir, 'a.json'), '{}');
    fs.writeFileSync(path.join(ctx.dir, 'b.txt'), 'x');
    fs.mkdirSync(path.join(ctx.dir, 'sub'));
    const res = await fastify.inject({ method: 'GET', url: `/api/json-lens/browse?dir=${encodeURIComponent(ctx.dir)}` });
    const body = res.json();
    const names = body.entries.map((e) => e.name);
    expect(names).toContain('a.json');
    expect(names).toContain('sub');
    expect(names).not.toContain('b.txt');
  });

  it('returns 400 for a nonexistent directory', async () => {
    const res = await fastify.inject({ method: 'GET', url: `/api/json-lens/browse?dir=${encodeURIComponent(path.join(ctx.dir, 'nope'))}` });
    expect(res.statusCode).toBe(400);
  });
});

describe('file routes', () => {
  const filePath = () => path.join(ctx.dir, 'doc.json');

  it('writes then reads a file', async () => {
    const write = await fastify.inject({ method: 'POST', url: '/api/json-lens/file', payload: { path: filePath(), content: '{"a":1}' } });
    expect(write.statusCode).toBe(200);
    const read = await fastify.inject({ method: 'GET', url: `/api/json-lens/file?path=${encodeURIComponent(filePath())}` });
    expect(read.json().content).toBe('{"a":1}');
  });

  it('reports file-exists correctly before and after writing', async () => {
    const before = await fastify.inject({ method: 'GET', url: `/api/json-lens/file-exists?path=${encodeURIComponent(filePath())}` });
    expect(before.json()).toEqual({ exists: false });
    await fastify.inject({ method: 'POST', url: '/api/json-lens/file', payload: { path: filePath(), content: '{}' } });
    const after = await fastify.inject({ method: 'GET', url: `/api/json-lens/file-exists?path=${encodeURIComponent(filePath())}` });
    expect(after.json()).toEqual({ exists: true });
  });

  it('deletes a file', async () => {
    await fastify.inject({ method: 'POST', url: '/api/json-lens/file', payload: { path: filePath(), content: '{}' } });
    const del = await fastify.inject({ method: 'DELETE', url: `/api/json-lens/file?path=${encodeURIComponent(filePath())}` });
    expect(del.json()).toEqual({ ok: true });
    expect(fs.existsSync(filePath())).toBe(false);
  });

  it('renames a file', async () => {
    await fastify.inject({ method: 'POST', url: '/api/json-lens/file', payload: { path: filePath(), content: '{}' } });
    const to = path.join(ctx.dir, 'renamed.json');
    const res = await fastify.inject({ method: 'POST', url: '/api/json-lens/file/rename', payload: { from: filePath(), to } });
    expect(res.statusCode).toBe(200);
    expect(fs.existsSync(to)).toBe(true);
    expect(fs.existsSync(filePath())).toBe(false);
  });

  it('rejects an empty path on write', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/json-lens/file', payload: { content: '{}' } });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when reading a file that does not exist', async () => {
    const res = await fastify.inject({ method: 'GET', url: `/api/json-lens/file?path=${encodeURIComponent(path.join(ctx.dir, 'nope.json'))}` });
    expect(res.statusCode).toBe(400);
  });
});

describe('scratch routes', () => {
  it('starts with an empty scratch list', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/json-lens/scratches' });
    expect(res.json()).toEqual({ scratches: [] });
  });

  it('creates a scratch and defaults the name to Untitled', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/json-lens/scratches', payload: { content: '{"a":1}' } });
    const body = res.json();
    expect(body.name).toBe('Untitled');
    expect(typeof body.id).toBe('string');
    expect(typeof body.updatedAt).toBe('number');
  });

  it('creates a scratch with a given name and persists its content, readable back', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/json-lens/scratches', payload: { name: 'my doc', content: '{"a":1}' } });
    const { id } = create.json();
    const read = await fastify.inject({ method: 'GET', url: `/api/json-lens/scratches/${id}` });
    expect(read.json()).toEqual({ content: '{"a":1}' });
  });

  it('returns 404 for a scratch id that does not exist', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/json-lens/scratches/nope' });
    expect(res.statusCode).toBe(404);
  });

  it('updates a scratch\'s content and name via PUT, bumping updatedAt', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/json-lens/scratches', payload: { name: 'a', content: '{}' } });
    const { id, updatedAt: firstUpdatedAt } = create.json();
    const update = await fastify.inject({ method: 'PUT', url: `/api/json-lens/scratches/${id}`, payload: { name: 'renamed', content: '{"b":2}' } });
    const updated = update.json();
    expect(updated.name).toBe('renamed');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(firstUpdatedAt);
    const read = await fastify.inject({ method: 'GET', url: `/api/json-lens/scratches/${id}` });
    expect(read.json().content).toBe('{"b":2}');
  });

  it('returns 404 when updating a nonexistent scratch', async () => {
    const res = await fastify.inject({ method: 'PUT', url: '/api/json-lens/scratches/nope', payload: { name: 'x' } });
    expect(res.statusCode).toBe(404);
  });

  it('deletes a scratch, removing it from the list and its content file', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/json-lens/scratches', payload: { name: 'a', content: '{}' } });
    const { id } = create.json();
    const del = await fastify.inject({ method: 'DELETE', url: `/api/json-lens/scratches/${id}` });
    expect(del.json()).toEqual({ ok: true });
    const list = await fastify.inject({ method: 'GET', url: '/api/json-lens/scratches' });
    expect(list.json()).toEqual({ scratches: [] });
  });

  it('deleting an already-gone scratch id does not throw', async () => {
    const res = await fastify.inject({ method: 'DELETE', url: '/api/json-lens/scratches/never-existed' });
    expect(res.json()).toEqual({ ok: true });
  });

  it('persists scratches to disk under the scratches directory', async () => {
    await fastify.inject({ method: 'POST', url: '/api/json-lens/scratches', payload: { name: 'a', content: '{}' } });
    // ctx.dir *is* the mocked os.homedir() for this test — a statically
    // imported `os` in this file would resolve before the per-test mock
    // exists, so we use the fixture's own value rather than re-deriving it.
    const scratchesDir = path.join(ctx.dir, '.log-lens-scratches');
    expect(fs.existsSync(scratchesDir)).toBe(true);
    expect(fs.readdirSync(scratchesDir).length).toBeGreaterThan(0);
  });
});
