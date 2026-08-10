import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Store/registry modules load their persistence file once at import
    // time into a module-level variable — each test file gets its own
    // process (isolate: true is Vitest's default for the "forks" pool, but
    // pinned here explicitly since correctness here depends on it) so a
    // fresh module graph per file gives each one a clean slate without
    // needing manual module-cache resets.
    isolate: true,
    testTimeout: 10000,
  },
});
