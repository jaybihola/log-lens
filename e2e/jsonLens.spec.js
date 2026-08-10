import { test, expect } from '@playwright/test';
import { switchTool, visiblePane } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await switchTool(page, 'json');
});

test('format and minify a document', async ({ page }) => {
  await visiblePane(page).getByRole('button', { name: 'New blank tab' }).click();
  await visiblePane(page).locator('.cm-content').click();
  await page.keyboard.type('{"b":1,"a":2}');

  // lucide-react's `Indent` component is an alias re-exporting the
  // `list-indent-increase` icon file — its rendered SVG class follows the
  // underlying file name, not the imported component name.
  await visiblePane(page).locator('button:has(svg.lucide-list-indent-increase)').click();
  await expect(visiblePane(page).locator('.cm-content')).toContainText('"b": 1');
  await expect(visiblePane(page).locator('.json-validation')).toContainText('Valid JSON');

  await visiblePane(page).locator('button:has(svg.lucide-minimize-2)').click();
  await expect(visiblePane(page).locator('.cm-content')).toHaveText('{"b":1,"a":2}');
});

test('an invalid document is flagged, not silently accepted', async ({ page }) => {
  await visiblePane(page).getByRole('button', { name: 'New blank tab' }).click();
  await visiblePane(page).locator('.cm-content').click();
  await page.keyboard.type('{"a":}');
  await expect(visiblePane(page).locator('.json-validation.error')).toBeVisible();
});

test('save as scratch, close, and reopen from the sidebar with content intact', async ({ page }) => {
  await visiblePane(page).getByRole('button', { name: 'New blank tab' }).click();
  await visiblePane(page).locator('.cm-content').click();
  await page.keyboard.type('{"a":1}');

  await visiblePane(page).locator('.tab .tab-close').click();
  await expect(page.getByText('Unsaved tab')).toBeVisible();
  await page.getByRole('button', { name: 'Save as scratch' }).click();

  // Unlike Diff Lens, JSON Lens's sidebar defaults *open* (useJsonSidebar.js)
  // — no toggle click needed here.
  await visiblePane(page).locator('.json-file-row').first().click();
  await expect(visiblePane(page).locator('.cm-content')).toContainText('"a":1');
});
