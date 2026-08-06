import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-json-tabs';

function basename(p) {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

function makeTab(n) {
  return {
    id: `json-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `Untitled ${n}`,
    content: '',
    selectedFields: [],
    // 'new': never saved anywhere durable — closing it with content prompts
    // to save to a file or as a scratch. 'file'/'scratch': bound to a real
    // disk file or an app-managed scratch file respectively; savedContent is
    // the baseline last confirmed written there, so `content !== savedContent`
    // is the tab's dirty check regardless of origin.
    origin: 'new',
    filePath: null,
    scratchId: null,
    savedContent: '',
  };
}

// Defensive against tabs saved before these fields existed — old
// localStorage data just won't have the keys.
function normalizeTab(t) {
  return {
    ...t,
    selectedFields: Array.isArray(t.selectedFields) ? t.selectedFields : [],
    origin: t.origin === 'file' || t.origin === 'scratch' ? t.origin : 'new',
    filePath: typeof t.filePath === 'string' ? t.filePath : null,
    scratchId: typeof t.scratchId === 'string' ? t.scratchId : null,
    savedContent: typeof t.savedContent === 'string' ? t.savedContent : '',
  };
}

export function isTabDirty(tab) {
  return tab.content !== tab.savedContent;
}

// No forced "there must always be at least one tab" — an empty list just
// means the empty-state screen shows instead (see JsonFormatterApp).
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

// The JSON formatter's own tab list — mostly client-side, persisted to
// localStorage so reloading doesn't lose in-progress work (this is the
// "autosaves in the app" behavior for brand new, not-yet-saved-anywhere
// tabs). Tabs can additionally be bound to a real file on disk or an
// app-managed scratch (see useJsonFileSystem) — for those, this hook only
// tracks id/content/savedContent bookkeeping; reading/writing the actual
// file or scratch is the caller's job (JsonFormatterApp), since that's
// server I/O this hook has no business doing itself.
export function useJsonTabs() {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [state]);

  const activeTab = state.tabs.find((t) => t.id === state.activeId) || state.tabs[0] || null;

  const addTab = useCallback(() => {
    setState((prev) => {
      const tab = makeTab(prev.tabs.length + 1);
      return { tabs: [...prev.tabs, tab], activeId: tab.id };
    });
    return null;
  }, []);

  // A pre-filled draft — e.g. "send this log line to JSON Lens" — rather
  // than the empty tab addTab() makes. Still origin: 'new' (nothing durable
  // has happened yet; it's autosaved to localStorage the same as any other
  // draft, and closing it with content prompts the usual save/scratch/
  // discard choice).
  const addTabWithContent = useCallback((content, name) => {
    setState((prev) => {
      const tab = { ...makeTab(prev.tabs.length + 1), content, name: name || `Untitled ${prev.tabs.length + 1}` };
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

  const duplicateTab = useCallback((id) => {
    setState((prev) => {
      const src = prev.tabs.find((t) => t.id === id);
      if (!src) return prev;
      // A duplicate is always a fresh, unsaved draft — two tabs silently
      // sharing the same filePath/scratchId would fight over which one's
      // "Save" wins.
      const tab = { ...makeTab(prev.tabs.length + 1), name: `${src.name} copy`, content: src.content, selectedFields: [...src.selectedFields] };
      const idx = prev.tabs.findIndex((t) => t.id === id);
      const tabs = [...prev.tabs.slice(0, idx + 1), tab, ...prev.tabs.slice(idx + 1)];
      return { tabs, activeId: tab.id };
    });
  }, []);

  const closeOtherTabs = useCallback((keepId) => {
    setState((prev) => {
      const keep = prev.tabs.find((t) => t.id === keepId);
      return keep ? { tabs: [keep], activeId: keep.id } : prev;
    });
  }, []);

  const closeTabsToRight = useCallback((id) => {
    setState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const tabs = prev.tabs.slice(0, idx + 1);
      const activeId = tabs.some((t) => t.id === prev.activeId) ? prev.activeId : id;
      return { tabs, activeId };
    });
  }, []);

  const updateTab = useCallback((id, patch) => {
    setState((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const renameTab = useCallback((id, name) => updateTab(id, { name }), [updateTab]);
  const setContent = useCallback((id, content) => updateTab(id, { content }), [updateTab]);
  const setSelectedFields = useCallback((id, selectedFields) => updateTab(id, { selectedFields }), [updateTab]);

  // Opening a file/scratch that's already open in some tab just activates
  // that tab rather than opening a second, independently-edited copy of it.
  const openFileTab = useCallback((filePath, content) => {
    setState((prev) => {
      const existing = prev.tabs.find((t) => t.origin === 'file' && t.filePath === filePath);
      if (existing) return { ...prev, activeId: existing.id };
      const tab = {
        ...makeTab(prev.tabs.length + 1),
        name: basename(filePath),
        content,
        origin: 'file',
        filePath,
        savedContent: content,
      };
      return { tabs: [...prev.tabs, tab], activeId: tab.id };
    });
  }, []);

  const openScratchTab = useCallback((scratchId, name, content) => {
    setState((prev) => {
      const existing = prev.tabs.find((t) => t.origin === 'scratch' && t.scratchId === scratchId);
      if (existing) return { ...prev, activeId: existing.id };
      const tab = {
        ...makeTab(prev.tabs.length + 1),
        name,
        content,
        origin: 'scratch',
        scratchId,
        savedContent: content,
      };
      return { tabs: [...prev.tabs, tab], activeId: tab.id };
    });
  }, []);

  // Called after a successful write — to disk, to a scratch, or converting
  // a 'new' tab into one or the other. Whatever `content` was just persisted
  // becomes the new dirty-check baseline.
  const markSaved = useCallback((id, patch = {}) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => {
        if (t.id !== id) return t;
        const content = patch.content !== undefined ? patch.content : t.content;
        return { ...t, ...patch, content, savedContent: content };
      }),
    }));
  }, []);

  const revertTab = useCallback((id) => {
    setState((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.id === id ? { ...t, content: t.savedContent } : t)) }));
  }, []);

  return {
    tabs: state.tabs,
    activeTabId: state.activeId,
    activeTab,
    addTab,
    addTabWithContent,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    duplicateTab,
    activateTab,
    renameTab,
    setContent,
    setSelectedFields,
    openFileTab,
    openScratchTab,
    markSaved,
    revertTab,
  };
}
