import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTempHome } from '../../../test/withTempHome.js';
import fs from 'node:fs';
import path from 'node:path';

let ctx;
let getTab;
let createTab;
let closeTab;
let allTabs;

beforeEach(async () => {
  process.env.LOG_LENS_POLL_MS = '15';
  ctx = await withTempHome();
  ({ getTab, createTab, closeTab, allTabs } = await import('../tabs/registry.js'));
});

afterEach(async () => {
  for (const tab of allTabs()) closeTab(tab.id);
  ctx.cleanup();
  delete process.env.LOG_LENS_POLL_MS;
  delete process.env.LOG_LENS_MAX_LINES;
});

function waitFor(predicate, { timeout = 3000, interval = 15 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      let result;
      try { result = predicate(); } catch (e) { reject(e); return; }
      if (result) { resolve(); return; }
      if (Date.now() - start > timeout) { reject(new Error('waitFor: timed out')); return; }
      setTimeout(tick, interval);
    };
    tick();
  });
}

describe('tailing a real file', () => {
  it('picks up a line appended after the tab is opened', async () => {
    const filePath = path.join(ctx.dir, 'app.log');
    fs.writeFileSync(filePath, '');
    const tab = createTab(filePath);
    await waitFor(() => getTab(tab.id).status === 'watching');

    fs.appendFileSync(filePath, 'first line\n');
    await waitFor(() => getTab(tab.id).buffer.length === 1);
    expect(getTab(tab.id).buffer[0].text).toBe('first line');
  });

  it('picks up multiple appends across separate polls', async () => {
    const filePath = path.join(ctx.dir, 'app.log');
    fs.writeFileSync(filePath, '');
    const tab = createTab(filePath);
    await waitFor(() => getTab(tab.id).status === 'watching');

    fs.appendFileSync(filePath, 'line1\n');
    await waitFor(() => getTab(tab.id).buffer.length === 1);
    fs.appendFileSync(filePath, 'line2\n');
    await waitFor(() => getTab(tab.id).buffer.length === 2);
    expect(getTab(tab.id).buffer.map((l) => l.text)).toEqual(['line1', 'line2']);
  });

  it('recovers from truncation (file shrinks) by re-reading from the new start', async () => {
    const filePath = path.join(ctx.dir, 'app.log');
    fs.writeFileSync(filePath, 'before-truncate\n');
    const tab = createTab(filePath);
    await waitFor(() => getTab(tab.id).buffer.length === 1);

    // Simulate a fresh run overwriting the file with less content than was
    // already read — tailing.js must detect stat.size < lastSize and reset.
    fs.writeFileSync(filePath, 'after-truncate\n');
    await waitFor(() => getTab(tab.id).buffer.some((l) => l.text === 'after-truncate'));
    const texts = getTab(tab.id).buffer.map((l) => l.text);
    expect(texts).toContain('after-truncate');
  });

  it('joins indented continuation lines into the previous message', async () => {
    const filePath = path.join(ctx.dir, 'app.log');
    fs.writeFileSync(filePath, '');
    const tab = createTab(filePath);
    await waitFor(() => getTab(tab.id).status === 'watching');

    fs.appendFileSync(filePath, 'warn: Category[0]\n  System.Exception: boom\n    at Foo.Bar()\n');
    // The continuation is only flushed after a short quiet period (400ms
    // flushTimer) once nothing else follows it — wait past that.
    await waitFor(() => getTab(tab.id).buffer.length === 1, { timeout: 2000 });
    expect(getTab(tab.id).buffer[0].text).toBe('warn: Category[0]\n  System.Exception: boom\n    at Foo.Bar()');
  });

  it('flushes a message immediately once a new non-continuation line arrives', async () => {
    const filePath = path.join(ctx.dir, 'app.log');
    fs.writeFileSync(filePath, '');
    const tab = createTab(filePath);
    await waitFor(() => getTab(tab.id).status === 'watching');

    fs.appendFileSync(filePath, 'warn: first\n  continued\nwarn: second\n');
    await waitFor(() => getTab(tab.id).buffer.length === 2);
    expect(getTab(tab.id).buffer[0].text).toBe('warn: first\n  continued');
    expect(getTab(tab.id).buffer[1].text).toBe('warn: second');
  });

  it('caps the buffer at maxLines, dropping the oldest entries', async () => {
    process.env.LOG_LENS_MAX_LINES = '3';
    vi.resetModules();
    ({ getTab, createTab, closeTab, allTabs } = await import('../tabs/registry.js'));

    const filePath = path.join(ctx.dir, 'app.log');
    fs.writeFileSync(filePath, '');
    const tab = createTab(filePath);
    await waitFor(() => getTab(tab.id).status === 'watching');

    for (let i = 1; i <= 5; i++) {
      fs.appendFileSync(filePath, `line${i}\n`);
      await waitFor(() => getTab(tab.id).buffer.some((l) => l.text === `line${i}`));
    }
    const texts = getTab(tab.id).buffer.map((l) => l.text);
    expect(texts).toHaveLength(3);
    expect(texts).toEqual(['line3', 'line4', 'line5']);
  });

  it('marks a tab as missing when its file does not exist', async () => {
    const tab = createTab(path.join(ctx.dir, 'does-not-exist.log'));
    await waitFor(() => getTab(tab.id).status === 'missing');
    expect(getTab(tab.id).status).toBe('missing');
  });
});
