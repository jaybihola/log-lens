import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-mock-tabs';

function makeId() {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const EDITABLE_FIELDS = ['method', 'url', 'params', 'headers', 'body', 'auth'];

function editableSnapshot(tab) {
  return EDITABLE_FIELDS.reduce((acc, key) => { acc[key] = tab[key]; return acc; }, {});
}

function makeTab(n, overrides = {}) {
  return {
    id: makeId(),
    name: `Request ${n}`,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { mode: 'none', content: '' },
    auth: { type: 'none' },
    // 'draft': never saved to a collection — closing it with a URL typed in
    // just discards it, no prompt (unlike JSON Lens, there's no file/scratch
    // to lose — the collection is the only durable place a request lives).
    // 'saved': bound to (collectionId, requestId); savedSnapshot is the
    // baseline last written there, so isTabDirty compares against it.
    origin: 'draft',
    collectionId: null,
    requestId: null,
    savedSnapshot: null,
    response: null,
    sending: false,
    ...overrides,
  };
}

function normalizeTab(t) {
  return {
    ...makeTab(1),
    ...t,
    response: null, // never trust a stale response across a reload — resend to see one
    sending: false,
  };
}

export function isTabDirty(tab) {
  if (tab.origin !== 'saved') return tab.url.trim() !== '';
  return JSON.stringify(editableSnapshot(tab)) !== JSON.stringify(tab.savedSnapshot);
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && Array.isArray(raw.tabs)) {
      const tabs = raw.tabs.map(normalizeTab);
      const activeId = raw.activeId && tabs.some((t) => t.id === raw.activeId) ? raw.activeId : (tabs[0]?.id ?? null);
      return { tabs, activeId };
    }
  } catch { /* fall through to an empty tab list */ }
  return { tabs: [], activeId: null };
}

// Mirrors useJsonTabs.js's shape: local-first, localStorage-persisted so a
// reload never loses in-progress request edits, with 'saved' tabs additionally
// bound to a collection entry the caller (MockViewApp) reads/writes via
// mockViewApi. This hook owns only the tab list + editable fields, never
// does server I/O itself.
export function useMockTabs() {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      const persistable = { ...state, tabs: state.tabs.map(({ response, sending, ...t }) => t) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [state]);

  const activeTab = state.tabs.find((t) => t.id === state.activeId) || state.tabs[0] || null;

  const addTab = useCallback(() => {
    setState((prev) => {
      const tab = makeTab(prev.tabs.length + 1);
      return { tabs: [...prev.tabs, tab], activeId: tab.id };
    });
  }, []);

  const closeTab = useCallback((id) => {
    setState((prev) => {
      const tabs = prev.tabs.filter((t) => t.id !== id);
      const activeId = tabs.length === 0 ? null : (prev.activeId === id ? tabs[tabs.length - 1].id : prev.activeId);
      return { tabs, activeId };
    });
  }, []);

  const activateTab = useCallback((id) => {
    setState((prev) => (prev.tabs.some((t) => t.id === id) ? { ...prev, activeId: id } : prev));
  }, []);

  const renameTab = useCallback((id, name) => {
    setState((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.id === id ? { ...t, name } : t)) }));
  }, []);

  const updateTab = useCallback((id, patch) => {
    setState((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  // Opening a request already bound to an open tab just activates that tab
  // instead of opening a second, independently-edited copy of it.
  const openSavedRequest = useCallback((collectionId, requestId, fields) => {
    setState((prev) => {
      const existing = prev.tabs.find((t) => t.origin === 'saved' && t.requestId === requestId);
      if (existing) return { ...prev, activeId: existing.id };
      const tab = makeTab(prev.tabs.length + 1, {
        name: fields.name,
        ...editableSnapshot(fields),
        origin: 'saved',
        collectionId,
        requestId,
        savedSnapshot: editableSnapshot(fields),
      });
      return { tabs: [...prev.tabs, tab], activeId: tab.id };
    });
  }, []);

  // Called after a successful create/update against a collection — whatever
  // fields were just persisted become the new dirty-check baseline.
  const markSaved = useCallback((id, { collectionId, requestId, name }) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, origin: 'saved', collectionId, requestId, name: name ?? t.name };
        return { ...next, savedSnapshot: editableSnapshot(next) };
      }),
    }));
  }, []);

  const setResponse = useCallback((id, response) => updateTab(id, { response, sending: false }), [updateTab]);
  const setSending = useCallback((id, sending) => updateTab(id, { sending, ...(sending ? { response: null } : {}) }), [updateTab]);

  return {
    tabs: state.tabs,
    activeTabId: state.activeId,
    activeTab,
    addTab,
    closeTab,
    activateTab,
    renameTab,
    updateTab,
    openSavedRequest,
    markSaved,
    setResponse,
    setSending,
  };
}
