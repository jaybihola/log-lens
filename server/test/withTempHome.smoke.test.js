import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempHome } from './withTempHome.js';

let ctx;
beforeEach(async () => { ctx = await withTempHome(); });
afterEach(() => ctx.cleanup());

describe('withTempHome', () => {
  it('redirects os.homedir() for a dynamically-imported module', async () => {
    const os = (await import('node:os')).default;
    expect(os.homedir()).toBe(ctx.dir);
  });

  it('gives config.js a state file path under the temp dir', async () => {
    const { JSON_LENS_STATE_FILE } = await import('../src/config.js');
    expect(JSON_LENS_STATE_FILE.startsWith(ctx.dir)).toBe(true);
  });

  it('gives each test its own isolated store state', async () => {
    const { createScratch, listScratches } = await import('../src/jsonLens/store.js');
    expect(listScratches()).toEqual([]);
    createScratch('test', 'content');
    expect(listScratches()).toHaveLength(1);
  });

  it('does not leak the previous test\'s scratch into a fresh temp home', async () => {
    // Deliberately relies on test execution order (this file has no
    // parallelism within itself) — the previous test created a scratch;
    // this one, in a brand-new withTempHome(), must not see it.
    const { listScratches } = await import('../src/jsonLens/store.js');
    expect(listScratches()).toEqual([]);
  });
});
