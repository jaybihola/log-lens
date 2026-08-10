// All three tools mount simultaneously and stay mounted (see App.jsx) — a
// selector that isn't scoped to the currently-visible one can match a
// same-named element sitting hidden in one of the other two, so every
// helper here scopes through `.mode-pane:not(.hidden)`.
const MODE_INDEX = { logs: 0, json: 1, diff: 2 };

export async function switchTool(page, name) {
  await page.locator('.mode-sidebar button').nth(MODE_INDEX[name]).click();
}

export function visiblePane(page) {
  return page.locator('.mode-pane:not(.hidden)');
}
