import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-diff-tabs';

const DEFAULT_OPTIONS = {
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreBlankLines: false,
  ignoreLineEndings: false,
};

// The fields a scratch actually persists — everything else on a tab
// (viewMode, id, name) is either a UI preference or bookkeeping, not part
// of "the comparison" itself.
function snapshotOf(tab) {
  return { leftText: tab.leftText, rightText: tab.rightText, language: tab.language, options: { ...tab.options } };
}

function makeTab(n) {
  const blank = { leftText: '', rightText: '', language: 'plaintext', options: { ...DEFAULT_OPTIONS } };
  return {
    id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `Comparison ${n}`,
    ...blank,
    viewMode: 'side-by-side',
    // 'new': never saved anywhere durable — closing it with content prompts
    // to save it as a scratch. 'scratch': bound to an app-managed scratch
    // (see useDiffScratches.js); savedSnapshot is the baseline last
    // confirmed written there, so comparing against it is the dirty check
    // regardless of origin.
    origin: 'new',
    scratchId: null,
    savedSnapshot: blank,
  };
}

// Defensive against tabs saved before these fields existed — old
// localStorage data just won't have the keys.
function normalizeTab(t) {
  const leftText = typeof t.leftText === 'string' ? t.leftText : '';
  const rightText = typeof t.rightText === 'string' ? t.rightText : '';
  const language = typeof t.language === 'string' ? t.language : 'plaintext';
  const options = { ...DEFAULT_OPTIONS, ...(t.options || {}) };
  return {
    ...t,
    leftText, rightText, language, options,
    viewMode: t.viewMode === 'unified' ? 'unified' : 'side-by-side',
    origin: t.origin === 'scratch' ? 'scratch' : 'new',
    scratchId: typeof t.scratchId === 'string' ? t.scratchId : null,
    savedSnapshot: t.savedSnapshot && typeof t.savedSnapshot.leftText === 'string'
      ? { ...t.savedSnapshot, options: { ...DEFAULT_OPTIONS, ...(t.savedSnapshot.options || {}) } }
      : { leftText: '', rightText: '', language: 'plaintext', options: { ...DEFAULT_OPTIONS } },
  };
}

export function isTabDirty(tab) {
  const snap = tab.savedSnapshot;
  return tab.leftText !== snap.leftText
    || tab.rightText !== snap.rightText
    || tab.language !== snap.language
    || JSON.stringify(tab.options) !== JSON.stringify(snap.options);
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

// Diff Lens's tab list — modeled on jsonLens/hooks/useJsonTabs.js. Unlike
// v1, tabs can now be bound to an app-managed scratch (see
// useDiffScratches.js) as well as being plain, not-yet-saved-anywhere
// drafts — but there's still no "file" origin (no folder browsing for Diff
// Lens, per the plan), so the origin enum is narrower than JSON Lens's.
export function useDiffTabs() {
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
      // sharing the same scratchId would fight over which one's Save wins.
      const tab = {
        ...makeTab(prev.tabs.length + 1),
        name: `${src.name} copy`,
        leftText: src.leftText,
        rightText: src.rightText,
        language: src.language,
        viewMode: src.viewMode,
        options: { ...src.options },
      };
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
  const setLeftText = useCallback((id, leftText) => updateTab(id, { leftText }), [updateTab]);
  const setRightText = useCallback((id, rightText) => updateTab(id, { rightText }), [updateTab]);
  const setLanguage = useCallback((id, language) => updateTab(id, { language }), [updateTab]);
  const setViewMode = useCallback((id, viewMode) => updateTab(id, { viewMode }), [updateTab]);

  const setOption = useCallback((id, key, value) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === id ? { ...t, options: { ...t.options, [key]: value } } : t)),
    }));
  }, []);

  const swapSides = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === id ? { ...t, leftText: t.rightText, rightText: t.leftText } : t)),
    }));
  }, []);

  const clearTab = useCallback((id) => updateTab(id, { leftText: '', rightText: '' }), [updateTab]);

  // Called after a successful write — creating a scratch, or saving back to
  // one already bound. Whatever the tab looks like *after* `patch` merges in
  // becomes the new dirty-check baseline.
  const markSaved = useCallback((id, patch = {}) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        return { ...next, savedSnapshot: snapshotOf(next) };
      }),
    }));
  }, []);

  const revertTab = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === id ? { ...t, ...t.savedSnapshot, options: { ...t.savedSnapshot.options } } : t)),
    }));
  }, []);

  // Opening a scratch that's already open in some tab just activates that
  // tab rather than opening a second, independently-edited copy of it.
  const openScratchTab = useCallback((scratchId, name, data) => {
    setState((prev) => {
      const existing = prev.tabs.find((t) => t.origin === 'scratch' && t.scratchId === scratchId);
      if (existing) return { ...prev, activeId: existing.id };
      const snapshot = { leftText: data.leftText, rightText: data.rightText, language: data.language, options: { ...data.options } };
      const tab = {
        ...makeTab(prev.tabs.length + 1),
        name,
        ...snapshot,
        options: { ...DEFAULT_OPTIONS, ...snapshot.options },
        origin: 'scratch',
        scratchId,
        savedSnapshot: snapshot,
      };
      return { tabs: [...prev.tabs, tab], activeId: tab.id };
    });
  }, []);

  return {
    tabs: state.tabs,
    activeTabId: state.activeId,
    activeTab,
    addTab,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    duplicateTab,
    activateTab,
    renameTab,
    setLeftText,
    setRightText,
    setLanguage,
    setViewMode,
    setOption,
    swapSides,
    clearTab,
    markSaved,
    revertTab,
    openScratchTab,
  };
}
