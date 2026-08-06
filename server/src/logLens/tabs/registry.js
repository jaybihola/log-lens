import path from 'node:path';
import { loadState, saveState } from '../state.js';
import { broadcastStatus } from '../sse.js';
import { startPolling, stopPolling, pushLine } from './tailing.js';
import { config } from '../../config.js';
import { restoreCredentialsFromState, getAllCredentialsForPersist } from '../credentials.js';
import { getSettings, setSettings, normalizeSettings, environmentUrl } from '../settings.js';
import { runEsSearch } from '../es/fieldCache.js';

export const tabs = new Map(); // id -> tab state
let nextTabId = 1;
export let activeTabId = null;

function makeTab(id) {
  return {
    id,
    kind: 'file',
    resolvedPath: null,
    buffer: [],
    seq: 0,
    lastSize: 0,
    partial: '',
    pendingLines: [],
    flushTimer: null,
    status: 'idle',
    pollTimer: null,
    // api-kind fields only
    environment: null,
    queryConfig: null,
    seenIds: null,
    fetchError: null,
  };
}

export function persistTabs() {
  const state = {
    activeTabId,
    credentials: getAllCredentialsForPersist(),
    settings: getSettings(),
    tabs: [...tabs.values()]
      .map((t) => (t.kind === 'api'
        ? { kind: 'api', environment: t.environment, queryConfig: t.queryConfig }
        : { path: t.resolvedPath }))
      .filter((t) => t.kind === 'api' || t.path),
  };
  saveState(state);
}

export function tabSummary(tab) {
  return {
    id: tab.id,
    kind: tab.kind,
    file: tab.resolvedPath,
    status: tab.status,
    environment: tab.environment,
    queryConfig: tab.queryConfig,
    fetchError: tab.fetchError,
  };
}

export function getTab(id) {
  return tabs.get(id);
}

export function allTabs() {
  return [...tabs.values()];
}

export function createTab(inputPath) {
  const tab = makeTab(String(nextTabId++));
  tabs.set(tab.id, tab);
  activeTabId = tab.id;
  if (inputPath) openFileForTab(tab, inputPath);
  else persistTabs();
  return tab;
}

export function openFileForTab(tab, inputPath) {
  stopPolling(tab);
  tab.kind = 'file';
  tab.resolvedPath = path.resolve(inputPath);
  tab.buffer = [];
  tab.seq = 0;
  tab.lastSize = 0;
  tab.partial = '';
  tab.pendingLines = [];
  tab.status = 'waiting';
  console.log(`[log-lens] tab ${tab.id} watching ${tab.resolvedPath}`);
  startPolling(tab, tabs, config.pollMs, config.maxLines);
  persistTabs();
  broadcastStatus(tab);
}

// ---- api tabs: not tailed — the user (or a caller re-running the same
// config) triggers fetchApiTab() to pull the latest matches from the
// configured search backend. configureApiTab always resets the buffer +
// dedup set, since a changed query is a fundamentally different result set,
// not a continuation.
export function createApiTab(environment, queryConfig) {
  const tab = makeTab(String(nextTabId++));
  tabs.set(tab.id, tab);
  activeTabId = tab.id;
  configureApiTab(tab, environment, queryConfig);
  return tab;
}

export function configureApiTab(tab, environment, queryConfig) {
  stopPolling(tab);
  tab.kind = 'api';
  tab.resolvedPath = null;
  tab.environment = environment;
  tab.queryConfig = queryConfig;
  tab.buffer = [];
  tab.seq = 0;
  tab.seenIds = new Set();
  tab.fetchError = null;
  tab.status = 'idle';
  persistTabs();
  broadcastStatus(tab);
}

export async function fetchApiTab(tab) {
  tab.status = 'fetching';
  broadcastStatus(tab);
  let hits;
  try {
    hits = await runEsSearch(tab.environment, tab.queryConfig);
    tab.fetchError = null;
  } catch (e) {
    tab.fetchError = e.message;
    tab.status = 'error';
    broadcastStatus(tab);
    throw e;
  }
  let added = 0;
  for (const hit of hits) {
    if (tab.seenIds.has(hit._id)) continue; // already pushed in a prior fetch
    tab.seenIds.add(hit._id);
    pushLine(tab, JSON.stringify(hit._source), config.maxLines);
    added++;
  }
  tab.status = 'idle';
  broadcastStatus(tab);
  return { added, total: hits.length };
}

export function closeTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return;
  stopPolling(tab);
  tabs.delete(tabId);
  if (activeTabId === tabId) {
    const remaining = [...tabs.keys()];
    activeTabId = remaining.length ? remaining[0] : null;
  }
  console.log(`[log-lens] closed tab ${tabId}`);
  persistTabs();
}

export function activateTab(tabId) {
  activeTabId = tabId;
  persistTabs();
}

export function restoreFromState() {
  const state = loadState();
  restoreCredentialsFromState(state.credentials);
  if (state.settings) {
    const normalized = normalizeSettings(state.settings);
    // Only override the settings-file config if the state file actually has
    // something in it — an empty override (e.g. persisted by a run that
    // started before log-lens.settings.json existed) must not permanently
    // shadow real file-based config on every later restart.
    if (normalized.environments.length) setSettings(normalized);
  }
  for (const saved of state.tabs) {
    if (saved.kind === 'api' && environmentUrl(saved.environment)) {
      // A file tab recovers its content for free on restart — startPolling
      // just re-reads the still-there file from disk. An api tab has no such
      // disk-backed source, so without an explicit re-fetch here it comes
      // back with an empty buffer (looking, from the browser, exactly like a
      // refresh had wiped it) until the user manually clicks "Fetch new".
      const tab = createApiTab(saved.environment, saved.queryConfig || {});
      fetchApiTab(tab).catch((e) => {
        console.error(`[log-lens] failed to re-fetch restored api tab ${tab.id}: ${e.message}`);
      });
    } else if (saved.path) {
      createTab(saved.path);
    }
  }
  if (state.activeTabId && tabs.has(state.activeTabId)) {
    activeTabId = state.activeTabId;
  }
}

export function getActiveTabId() {
  return activeTabId;
}
