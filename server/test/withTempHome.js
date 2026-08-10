import { vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Every store module (config.js's *_STATE_FILE/*_SCRATCHES_DIR constants are
// computed once, at import time, from os.homedir()) caches its persisted
// state in a module-level variable that only reloads on process restart.
// Tests need real isolation between cases without touching that source
// pattern — this redirects os.homedir() to a fresh temp dir and forces a
// clean module registry, so a dynamic import() of anything downstream of
// config.js (store.js, routes.js, settings.js, ...) re-evaluates against
// the new, empty HOME instead of reusing a previous test's in-memory state.
//
// SETTINGS_FILE is the one path in config.js keyed off process.cwd() rather
// than os.homedir() (it's meant to be a project-level config file, not a
// per-user one) — so this also chdir()s into the temp dir, or a real
// `log-lens.settings.json` sitting in this repo (there's a mock one used for
// local dev) leaks into every test that touches settings.js.
//
// Usage: call in beforeEach, dynamically `await import(...)` whatever
// you're testing (never a static top-level import — that would resolve
// before the mock is in place), and call the returned `cleanup()` in
// afterEach.
export async function withTempHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-lens-test-'));
  const originalCwd = process.cwd();
  process.chdir(dir);
  vi.resetModules();
  vi.doMock('node:os', async () => {
    const actual = await vi.importActual('node:os');
    return { ...actual, homedir: () => dir, default: { ...actual.default, homedir: () => dir } };
  });
  // No vi.unmock() here: it's unnecessary (the next test's withTempHome()
  // call re-registers the mock fresh via vi.doMock() regardless) and
  // vi.unmock() inside a nested function only *looks* deferred — Vitest
  // hoists mock-API calls to the top of the module regardless of nesting,
  // so calling it from inside this closure wouldn't actually run "on
  // cleanup" the way it appears to.
  return {
    dir,
    cleanup: () => {
      process.chdir(originalCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
