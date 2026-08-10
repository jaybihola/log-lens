import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Not automatic for Vitest the way it is for Jest — without this, a hook/
// component rendered in one test stays mounted into the next, and any of
// its still-pending effects (a scheduled requestAnimationFrame render, an
// open subscription) can fire mid-way through an unrelated test.
afterEach(() => cleanup());

// jsdom implements no real layout, so it never defines scrollIntoView at
// all — several components (CommandBar, JsonTableView, find bars) call it
// to keep the active/matched item visible. A no-op stub is enough; nothing
// here asserts on actual scroll position.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
