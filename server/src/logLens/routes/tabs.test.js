import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempHome } from '../../../test/withTempHome.js';
import fs from 'node:fs';
import path from 'node:path';

let ctx;
let fastify;

beforeEach(async () => {
  ctx = await withTempHome();
  const Fastify = (await import('fastify')).default;
  const tabRoutes = (await import('./tabs.js')).default;
  const settingsRoutes = (await import('./settings.js')).default;
  fastify = Fastify();
  await fastify.register(tabRoutes);
  await fastify.register(settingsRoutes);
});

afterEach(async () => {
  // A file-kind tab's polling is a real setInterval — closing every tab
  // this test created (regardless of how the test itself ended) is what
  // keeps this file from leaking a timer into whatever runs after it.
  const { allTabs, closeTab } = await import('../tabs/registry.js');
  for (const tab of allTabs()) closeTab(tab.id);
  await fastify.close();
  ctx.cleanup();
});

describe('GET /api/tabs', () => {
  it('starts with no tabs and no active tab', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/tabs' });
    expect(res.json()).toEqual({ tabs: [], activeTabId: null });
  });
});

describe('POST /api/tabs', () => {
  it('creates an empty file-kind tab when no path is given', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    const body = res.json();
    expect(body.kind).toBe('file');
    expect(body.file).toBeNull();
    expect(body.status).toBe('idle');
  });

  it('creates a tab watching a real file and reports it as watching after the first poll', async () => {
    const filePath = path.join(ctx.dir, 'app.log');
    fs.writeFileSync(filePath, 'line1\n');
    const res = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: { path: filePath } });
    const body = res.json();
    expect(body.file).toBe(filePath);
    expect(['waiting', 'watching']).toContain(body.status);
  });

  it('becomes the active tab', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    const list = await fastify.inject({ method: 'GET', url: '/api/tabs' });
    expect(list.json().activeTabId).toBe(res.json().id);
  });

  it('creates an api-kind tab given a valid environment', async () => {
    await fastify.inject({ method: 'POST', url: '/api/settings', payload: { environments: [{ name: 'prod', url: 'http://x' }] } });
    const res = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: { kind: 'api', environment: 'prod', queryConfig: { index: 'logs-*' } } });
    expect(res.json().kind).toBe('api');
  });

  it('rejects an api-kind tab for an unknown environment', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: { kind: 'api', environment: 'nope' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/tabs/:id/open', () => {
  it('repoints an existing tab at a new file', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    const filePath = path.join(ctx.dir, 'other.log');
    fs.writeFileSync(filePath, '');
    const res = await fastify.inject({ method: 'POST', url: `/api/tabs/${create.json().id}/open`, payload: { path: filePath } });
    expect(res.json().file).toBe(filePath);
  });

  it('returns 404 for a nonexistent tab id', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/tabs/nope/open', payload: { path: ctx.dir } });
    expect(res.statusCode).toBe(404);
  });

  it('requires a non-blank path', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    const res = await fastify.inject({ method: 'POST', url: `/api/tabs/${create.json().id}/open`, payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/tabs/:id/history', () => {
  it('returns the tab\'s buffer, file, and status', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    const res = await fastify.inject({ method: 'GET', url: `/api/tabs/${create.json().id}/history` });
    expect(res.json()).toMatchObject({ lines: [], file: null, kind: 'file' });
  });

  it('returns 404 for a nonexistent tab', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/tabs/nope/history' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/tabs/:id/clear', () => {
  it('empties the buffer', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    const id = create.json().id;
    const res = await fastify.inject({ method: 'POST', url: `/api/tabs/${id}/clear` });
    expect(res.json()).toEqual({ ok: true });
    const history = await fastify.inject({ method: 'GET', url: `/api/tabs/${id}/history` });
    expect(history.json().lines).toEqual([]);
  });
});

describe('POST /api/tabs/:id/activate', () => {
  it('switches the active tab', async () => {
    const a = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} }); // second tab becomes active by default
    await fastify.inject({ method: 'POST', url: `/api/tabs/${a.json().id}/activate` });
    const list = await fastify.inject({ method: 'GET', url: '/api/tabs' });
    expect(list.json().activeTabId).toBe(a.json().id);
  });
});

describe('DELETE /api/tabs/:id', () => {
  it('closes a tab, removing it from the list', async () => {
    const create = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    const del = await fastify.inject({ method: 'DELETE', url: `/api/tabs/${create.json().id}` });
    expect(del.json()).toEqual({ ok: true });
    const list = await fastify.inject({ method: 'GET', url: '/api/tabs' });
    expect(list.json().tabs).toEqual([]);
  });

  it('returns 404 for a nonexistent tab', async () => {
    const res = await fastify.inject({ method: 'DELETE', url: '/api/tabs/nope' });
    expect(res.statusCode).toBe(404);
  });

  it('promotes another open tab to active when the active one closes', async () => {
    const a = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    const b = await fastify.inject({ method: 'POST', url: '/api/tabs', payload: {} });
    await fastify.inject({ method: 'DELETE', url: `/api/tabs/${b.json().id}` });
    const list = await fastify.inject({ method: 'GET', url: '/api/tabs' });
    expect(list.json().activeTabId).toBe(a.json().id);
  });
});
