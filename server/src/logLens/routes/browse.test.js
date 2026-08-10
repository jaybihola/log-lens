import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempHome } from '../../../test/withTempHome.js';
import fs from 'node:fs';
import path from 'node:path';

let ctx;
let fastify;

beforeEach(async () => {
  ctx = await withTempHome();
  const Fastify = (await import('fastify')).default;
  const browseRoutes = (await import('./browse.js')).default;
  fastify = Fastify();
  await fastify.register(browseRoutes);
});

afterEach(async () => {
  await fastify.close();
  ctx.cleanup();
});

describe('GET /api/browse', () => {
  it('lists files and directories, sorted directories-first then alphabetically', async () => {
    fs.writeFileSync(path.join(ctx.dir, 'z.txt'), 'x');
    fs.writeFileSync(path.join(ctx.dir, 'a.txt'), 'x');
    fs.mkdirSync(path.join(ctx.dir, 'b-folder'));
    const res = await fastify.inject({ method: 'GET', url: `/api/browse?dir=${encodeURIComponent(ctx.dir)}` });
    const body = res.json();
    expect(body.entries.map((e) => e.name)).toEqual(['b-folder', 'a.txt', 'z.txt']);
    expect(body.entries.find((e) => e.name === 'b-folder').isDir).toBe(true);
  });

  it('hides dotfiles by default and shows them when showHidden=true', async () => {
    fs.writeFileSync(path.join(ctx.dir, '.hidden'), 'x');
    const hidden = await fastify.inject({ method: 'GET', url: `/api/browse?dir=${encodeURIComponent(ctx.dir)}` });
    expect(hidden.json().entries.map((e) => e.name)).not.toContain('.hidden');
    const shown = await fastify.inject({ method: 'GET', url: `/api/browse?dir=${encodeURIComponent(ctx.dir)}&showHidden=true` });
    expect(shown.json().entries.map((e) => e.name)).toContain('.hidden');
  });

  it('defaults to the home directory when dir is omitted', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/browse' });
    expect(res.json().dir).toBe(ctx.dir);
  });

  it('reports the parent directory, or null at a path with no parent', async () => {
    const sub = path.join(ctx.dir, 'sub');
    fs.mkdirSync(sub);
    const res = await fastify.inject({ method: 'GET', url: `/api/browse?dir=${encodeURIComponent(sub)}` });
    expect(res.json().parent).toBe(ctx.dir);

    const rootRes = await fastify.inject({ method: 'GET', url: `/api/browse?dir=${encodeURIComponent(path.parse(ctx.dir).root)}` });
    expect(rootRes.json().parent).toBeNull();
  });

  it('returns 400 for a nonexistent directory', async () => {
    const res = await fastify.inject({ method: 'GET', url: `/api/browse?dir=${encodeURIComponent(path.join(ctx.dir, 'nope'))}` });
    expect(res.statusCode).toBe(400);
  });
});
