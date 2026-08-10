import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SERVER_URL } from './ports.js';
import { visiblePane } from './helpers.js';

// Log Lens's own file-picker UI isn't exercised here — the tab is seeded
// directly through the isolated server's API (the same one the client
// itself calls), which is simpler and more robust than reverse-engineering
// the picker's flow, and just as real a test of tailing/filtering once the
// tab exists: that's the behavior actually under test.
async function createFileTab(filePath) {
  const res = await fetch(`${SERVER_URL}/api/tabs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });
  return res.json();
}

test.describe('Log Lens', () => {
  let logPath;

  test.beforeEach(async ({ page }) => {
    logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-lens-e2e-log-')), 'app.log');
    fs.writeFileSync(logPath, '');
    await createFileTab(logPath);
    await page.goto('/');
  });

  test('tails a real file live', async ({ page }) => {
    fs.appendFileSync(logPath, 'hello from the log file\n');
    await expect(visiblePane(page).getByText('hello from the log file')).toBeVisible({ timeout: 10000 });
  });

  test('a JQL filter narrows what is shown, live', async ({ page }) => {
    fs.appendFileSync(logPath, 'an error occurred\nall good here\n');
    await expect(visiblePane(page).getByText('an error occurred')).toBeVisible({ timeout: 10000 });
    await expect(visiblePane(page).getByText('all good here')).toBeVisible();

    await visiblePane(page).getByPlaceholder(/JQL filter/).fill('error');
    await expect(visiblePane(page).getByText('an error occurred')).toBeVisible();
    await expect(visiblePane(page).getByText('all good here')).not.toBeVisible();
  });

  test('a negated filter hides matching lines', async ({ page }) => {
    fs.appendFileSync(logPath, 'keep this one\ndrop this one\n');
    await expect(visiblePane(page).getByText('keep this one')).toBeVisible({ timeout: 10000 });
    await visiblePane(page).getByPlaceholder(/JQL filter/).fill('-drop');
    await expect(visiblePane(page).getByText('keep this one')).toBeVisible();
    await expect(visiblePane(page).getByText('drop this one')).not.toBeVisible();
  });
});
