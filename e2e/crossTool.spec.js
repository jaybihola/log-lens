import { test, expect } from '@playwright/test';
import { switchTool, visiblePane } from './helpers.js';

// All three tools mount once and stay mounted (see App.jsx) — switching the
// mode rail only toggles a `hidden` CSS class, never unmounts. This is the
// one property that's genuinely only provable end-to-end: a unit/component
// test of any single tool can't see the *other* tools' state surviving.
test('switching tools mid-task does not lose in-progress work in the tool left behind', async ({ page }) => {
  await page.goto('/');

  await switchTool(page, 'diff');
  await visiblePane(page).getByRole('button', { name: 'New comparison' }).click();
  await visiblePane(page).locator('.diff-side-by-side .cm-content').nth(0).click();
  await page.keyboard.type('unsaved diff text');

  await switchTool(page, 'json');
  await visiblePane(page).getByRole('button', { name: 'New blank tab' }).click();
  await visiblePane(page).locator('.cm-content').click();
  await page.keyboard.type('{"unsaved":true}');

  await switchTool(page, 'logs');
  await switchTool(page, 'diff');
  await expect(visiblePane(page).locator('.diff-side-by-side .cm-content').nth(0)).toHaveText('unsaved diff text');

  await switchTool(page, 'json');
  await expect(visiblePane(page).locator('.cm-content')).toContainText('"unsaved":true');
});

test('only the currently-visible tool is shown at a time', async ({ page }) => {
  await page.goto('/');
  await switchTool(page, 'json');
  await expect(page.locator('.mode-pane').nth(1)).not.toHaveClass(/hidden/);
  await expect(page.locator('.mode-pane').nth(0)).toHaveClass(/hidden/);
  await expect(page.locator('.mode-pane').nth(2)).toHaveClass(/hidden/);
});
