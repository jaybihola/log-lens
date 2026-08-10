import { test, expect } from '@playwright/test';
import { switchTool, visiblePane } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await switchTool(page, 'diff');
});

test('paste into both panes and see a correct diff', async ({ page }) => {
  await visiblePane(page).getByRole('button', { name: 'New comparison' }).click();
  const editors = visiblePane(page).locator('.diff-side-by-side .cm-content');
  await editors.nth(0).click();
  await page.keyboard.type('line1\nline2\nline3');
  await editors.nth(1).click();
  await page.keyboard.type('line1\nCHANGED\nline3');

  await expect(visiblePane(page).locator('.diff-stats')).toContainText('~1');
  await expect(visiblePane(page).locator('.cm-merge-a .cm-changedLine')).toBeVisible();
  await expect(visiblePane(page).locator('.cm-merge-b .cm-changedLine')).toBeVisible();
});

test('ignore-case collapses a case-only difference to "no differences"', async ({ page }) => {
  await visiblePane(page).getByRole('button', { name: 'New comparison' }).click();
  const editors = visiblePane(page).locator('.diff-side-by-side .cm-content');
  await editors.nth(0).click();
  await page.keyboard.type('HELLO');
  await editors.nth(1).click();
  await page.keyboard.type('hello');
  await expect(visiblePane(page).locator('.diff-stats')).toContainText('~1');

  await visiblePane(page).locator('button:has(svg.lucide-sliders-horizontal)').click();
  await visiblePane(page).getByText('Ignore case').click();
  await expect(visiblePane(page).locator('.diff-stats')).toContainText('No differences');
});

test('Unified view is read-only', async ({ page }) => {
  await visiblePane(page).getByRole('button', { name: 'New comparison' }).click();
  const editors = visiblePane(page).locator('.diff-side-by-side .cm-content');
  await editors.nth(0).click();
  await page.keyboard.type('a');
  await editors.nth(1).click();
  await page.keyboard.type('b');

  await visiblePane(page).locator('button:has(svg.lucide-rows-3)').click();
  const unifiedContent = visiblePane(page).locator('.diff-unified-view .cm-content');
  await expect(unifiedContent).toHaveAttribute('contenteditable', 'false');
});

test('save as scratch, close, and reopen from the sidebar with content intact', async ({ page }) => {
  await visiblePane(page).getByRole('button', { name: 'New comparison' }).click();
  const editors = visiblePane(page).locator('.diff-side-by-side .cm-content');
  await editors.nth(0).click();
  await page.keyboard.type('const a = 1;');
  await editors.nth(1).click();
  await page.keyboard.type('const a = 2;');

  await visiblePane(page).locator('.diff-toolbar button:has(svg.lucide-save)').click();
  await expect(visiblePane(page).locator('.tab-dirty-dot')).toHaveCount(0);

  await visiblePane(page).locator('.tab .tab-close').click();
  await expect(visiblePane(page).getByText('No comparison open')).toBeVisible();

  await visiblePane(page).locator('button:has(svg.lucide-panel-left)').click();
  await visiblePane(page).locator('.diff-file-row').first().click();

  const reopened = visiblePane(page).locator('.diff-side-by-side .cm-content');
  await expect(reopened.nth(0)).toHaveText('const a = 1;');
  await expect(reopened.nth(1)).toHaveText('const a = 2;');
});

test('closing an unsaved tab prompts to discard or save as scratch', async ({ page }) => {
  await visiblePane(page).getByRole('button', { name: 'New comparison' }).click();
  await visiblePane(page).locator('.diff-side-by-side .cm-content').nth(0).click();
  await page.keyboard.type('unsaved content');

  await visiblePane(page).locator('.tab .tab-close').click();
  await expect(page.getByText('Unsaved tab')).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(visiblePane(page).getByText('No comparison open')).toBeVisible();
});
