import fs from 'node:fs';
import { STATE_FILE } from './config.js';

export function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      activeTabId: parsed.activeTabId || null,
      tabs: Array.isArray(parsed.tabs) ? parsed.tabs : [],
      credentials: Array.isArray(parsed.credentials) ? parsed.credentials : null,
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : null,
    };
  } catch {
    return { activeTabId: null, tabs: [], credentials: null, settings: null };
  }
}

export function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {
    // not fatal — persistence just won't survive a restart
  }
}
