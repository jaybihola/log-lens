import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTempHome } from '../../../test/withTempHome.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Spawns the repo's own dependency-free mock ES server (server/mocks/
// mock-es-server.js) as a real child process for this file's duration,
// exercising fieldCache.js against a genuine HTTP round-trip rather than a
// mocked fetch — the plan's whole point for this subsystem.
const MOCK_ES_PORT = 39217;
const MOCK_ES_URL = `http://localhost:${MOCK_ES_PORT}/_msearch`;
const serverRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

let mockEs;
let ctx;

beforeAll(async () => {
  mockEs = spawn('node', ['mocks/mock-es-server.js', String(MOCK_ES_PORT)], {
    cwd: serverRoot,
    env: { ...process.env, MOCK_ES_DOC_COUNT: '20' },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${MOCK_ES_PORT}/`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('mock-es-server did not become ready in time');
}, 10000);

afterAll(() => {
  mockEs.kill();
});

beforeEach(async () => {
  ctx = await withTempHome();
});

afterEach(() => {
  ctx.cleanup();
});

async function setupEnvironment() {
  const { addCredential } = await import('../credentials.js');
  const { setSettings } = await import('../settings.js');
  const credentialId = addCredential('mock', 'user', 'pass');
  setSettings({
    environments: [{
      name: 'mock',
      url: MOCK_ES_URL,
      credentialId,
      indices: [{ pattern: 'logs-app-*', foldFilters: [{ key: 'status', path: 'event.status' }] }],
    }],
  });
}

describe('runEsSearch + fetchIndexFields against a real mock ES server', () => {
  it('fetches real hits from the mock server', async () => {
    await setupEnvironment();
    const { runEsSearch } = await import('./fieldCache.js');
    const hits = await runEsSearch('mock', { index: 'logs-app-*', kql: '' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]._source.event).toBeDefined();
  });

  it('populates the field-type cache from observed hits, so a later fetchIndexFields reflects real field names', async () => {
    await setupEnvironment();
    const { runEsSearch, fetchIndexFields } = await import('./fieldCache.js');

    const before = await fetchIndexFields('mock', 'logs-app-*');
    expect(before).toEqual([]);

    await runEsSearch('mock', { index: 'logs-app-*', kql: '' });

    const after = await fetchIndexFields('mock', 'logs-app-*');
    const names = after.map((f) => f.name);
    expect(names).toContain('event.type');
    expect(names).toContain('event.status');
    expect(names).toContain('message');
  });

  it('persists the field cache to disk so it survives past this process', async () => {
    await setupEnvironment();
    const { runEsSearch } = await import('./fieldCache.js');
    await runEsSearch('mock', { index: 'logs-app-*', kql: '' });
    const { INDEX_FIELDS_STATE_FILE } = await import('../../config.js');
    const fs = await import('node:fs');
    expect(fs.existsSync(INDEX_FIELDS_STATE_FILE)).toBe(true);
    const persisted = JSON.parse(fs.readFileSync(INDEX_FIELDS_STATE_FILE, 'utf8'));
    expect(Object.keys(persisted)).toContain('mock:logs-app-*');
  });

  it('throws a clear error for an unknown environment', async () => {
    const { runEsSearch } = await import('./fieldCache.js');
    await expect(runEsSearch('nope', {})).rejects.toThrow(/unknown environment/);
  });

  it('throws when the environment has no credential assigned', async () => {
    const { setSettings } = await import('../settings.js');
    setSettings({ environments: [{ name: 'nocred', url: MOCK_ES_URL, indices: [{ pattern: 'logs-app-*' }] }] });
    const { runEsSearch } = await import('./fieldCache.js');
    await expect(runEsSearch('nocred', { index: 'logs-app-*' })).rejects.toThrow(/No credential/);
  });

  it('fetchFoldFieldValues returns real terms-agg buckets from the mock server', async () => {
    await setupEnvironment();
    const { fetchFoldFieldValues } = await import('./fieldCache.js');
    const values = await fetchFoldFieldValues('mock', 'logs-app-*', 'status');
    expect(values.length).toBeGreaterThan(0);
    expect(['Started', 'Completed', 'Failed'].some((s) => values.includes(s))).toBe(true);
  });

  it('a KQL filter narrows the results returned by the real server', async () => {
    await setupEnvironment();
    const { runEsSearch } = await import('./fieldCache.js');
    const all = await runEsSearch('mock', { index: 'logs-app-*', kql: '' });
    const filtered = await runEsSearch('mock', { index: 'logs-app-*', kql: 'event.status:Failed' });
    expect(filtered.length).toBeLessThanOrEqual(all.length);
    expect(filtered.every((h) => h._source.event.status === 'Failed')).toBe(true);
  });
});
