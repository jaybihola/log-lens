import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useLiveEvents } from './useLiveEvents.js';
import { levelClass } from '../render/highlight.js';

function makeDefaultUi() {
  return {
    filterQuery: '', caseSensitive: false, autoscroll: true, paused: false, wrap: true, autoRefreshSec: 0,
    expandedSeqs: new Set(), pinnedSeqs: new Set(), columns: [],
    // The time-histogram's drag-to-select range ({ start, end } ms epoch, or
    // null) — a separate axis from filterQuery, see filter/compile.js.
    timeRange: null,
  };
}

// Owns tab metadata (for the tab bar) and, per tab, a mutable line buffer +
// small UI state (filter/autoscroll/pause). Buffers live in a ref (not React
// state) so a fast-tailing background tab doesn't force a re-render on every
// line — only the active tab schedules a (rAF-batched) render.
export function useTabs() {
  const buffersRef = useRef(new Map()); // id -> { buffer: [], ui: {...} }
  const activeTabIdRef = useRef(null);
  const historyLoadedRef = useRef(new Set());
  const rafScheduled = useRef(false);
  // Tab ids whose buffer array was push()-mutated since the last render —
  // needs a fresh array reference before React reads it again, or a
  // useMemo keyed on the buffer (see EntryView's `visible`) will never
  // recompute and the view can appear to freeze/go blank until something
  // else happens to change one of its other dependencies.
  const dirtyBuffersRef = useRef(new Set());

  const [tabMetaList, setTabMetaList] = useState([]);
  const [activeTabId, setActiveTabIdState] = useState(null);
  const [renderTick, setRenderTick] = useState(0);
  // Unseen error/warn line counts for background tabs — id -> count. A real
  // React state (not the buffer ref) since a tab bar badge needs to actually
  // re-render when this changes even while its own tab stays in the
  // background; kept separate from tabMetaList since it changes far more
  // often than tab metadata does.
  const [attentionCounts, setAttentionCounts] = useState({});

  const scheduleRender = useCallback(() => {
    if (rafScheduled.current) return;
    rafScheduled.current = true;
    requestAnimationFrame(() => {
      rafScheduled.current = false;
      // One shallow copy per dirtied tab per rendered frame (not per line) —
      // batches with the same rAF coalescing that already limits renders to
      // once per frame during a fast tail.
      for (const id of dirtyBuffersRef.current) {
        const entry = buffersRef.current.get(id);
        if (entry) entry.buffer = entry.buffer.slice();
      }
      dirtyBuffersRef.current.clear();
      setRenderTick((t) => t + 1);
    });
  }, []);

  const ensureEntry = useCallback((id) => {
    if (!buffersRef.current.has(id)) {
      // lastLineAt seeds to "now" rather than null/0 — we don't know the
      // true last-arrival time before the client started watching this tab,
      // and seeding to "now" avoids the silence indicator (see TabBar.jsx)
      // falsely claiming a brand-new tab has already been quiet for ages.
      buffersRef.current.set(id, { buffer: [], ui: makeDefaultUi(), lastLineAt: Date.now() });
    }
    return buffersRef.current.get(id);
  }, []);

  // Read-only, ref-backed (not React state) so polling it doesn't itself
  // force a render — TabBar's own tick interval re-renders and reads this on
  // each tick instead. Keeps the "silence indicator" cheap even with many
  // fast-tailing background tabs.
  const getLastLineAt = useCallback((id) => buffersRef.current.get(id)?.lastLineAt ?? null, []);

  const loadHistory = useCallback(async (id) => {
    const data = await api.history(id);
    const entry = ensureEntry(id);
    // A tab can receive live SSE lines before its history fetch resolves
    // (both start near-boot); seq is monotonic per tab, so keep only
    // already-buffered lines newer than what history just gave us.
    const maxHistorySeq = data.lines.length ? data.lines[data.lines.length - 1].seq : 0;
    const newer = entry.buffer.filter((l) => l.seq > maxHistorySeq);
    entry.buffer = [...data.lines, ...newer];
    historyLoadedRef.current.add(id);
    if (id === activeTabIdRef.current) scheduleRender();
    return data;
  }, [ensureEntry, scheduleRender]);

  const refreshTabList = useCallback(async () => {
    const { tabs, activeTabId: active } = await api.listTabs();
    setTabMetaList(tabs);
    tabs.forEach((t) => ensureEntry(t.id));
    return { tabs, active };
  }, [ensureEntry]);

  const setActiveTab = useCallback((id) => {
    activeTabIdRef.current = id;
    setActiveTabIdState(id);
    if (id && !historyLoadedRef.current.has(id)) loadHistory(id);
    else scheduleRender();
  }, [loadHistory, scheduleRender]);

  // ---- boot ----
  useEffect(() => {
    (async () => {
      const { tabs, active } = await refreshTabList();
      if (!tabs.length) return;
      const activeId = (active && tabs.some((t) => t.id === active)) ? active : tabs[0].id;
      await Promise.all(tabs.map((t) => loadHistory(t.id)));
      activeTabIdRef.current = activeId;
      setActiveTabIdState(activeId);
      scheduleRender();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- live updates ----
  const handleLine = useCallback(({ tabId, seq, text }) => {
    const entry = ensureEntry(tabId);
    const last = entry.buffer[entry.buffer.length - 1];
    if (last && seq <= last.seq) return; // dup from the history/SSE boot race
    entry.buffer.push({ seq, text });
    entry.lastLineAt = Date.now();
    if (tabId === activeTabIdRef.current) {
      dirtyBuffersRef.current.add(tabId);
      scheduleRender();
    } else {
      // Background-tab attention signal — never fires for the tab you're
      // actually looking at (see the branch above), resets the moment the
      // user activates the tab (activateTab, below).
      const lvl = levelClass(text);
      if (lvl === 'lvl-error' || lvl === 'lvl-warn') {
        setAttentionCounts((prev) => ({ ...prev, [tabId]: (prev[tabId] || 0) + 1 }));
      }
    }
  }, [ensureEntry, scheduleRender]);

  const handleStatus = useCallback(({ tabId, status, file, fetchError }) => {
    setTabMetaList((prev) => prev.map((t) => (t.id === tabId ? { ...t, status, file, fetchError } : t)));
  }, []);

  const handleBootChanged = useCallback(() => {
    // Server process restarted — a restarted process re-numbers tab seqs from
    // scratch, so a stale buffer would make the seq<=last.seq dedup guard in
    // handleLine silently swallow every future line for a tab that isn't
    // active right now. Clear every buffer immediately (synchronously, before
    // any more SSE lines can land), then reload from scratch.
    historyLoadedRef.current.clear();
    for (const entry of buffersRef.current.values()) entry.buffer = [];
    refreshTabList().then(({ tabs }) => {
      if (tabs.some((t) => t.id === activeTabIdRef.current)) loadHistory(activeTabIdRef.current);
    });
  }, [refreshTabList, loadHistory]);

  useLiveEvents({ onLine: handleLine, onStatus: handleStatus, onBootChanged: handleBootChanged });

  // ---- actions ----
  const registerCreatedTab = useCallback((tab) => {
    ensureEntry(tab.id);
    setTabMetaList((prev) => [...prev, tab]);
    setActiveTab(tab.id);
    return tab;
  }, [ensureEntry, setActiveTab]);

  const openNewTab = useCallback(async (filePath) => {
    const tab = await api.createFileTab(filePath);
    return registerCreatedTab(tab);
  }, [registerCreatedTab]);

  const createRemoteTab = useCallback(async (environment, queryConfig) => {
    const tab = await api.createApiTab(environment, queryConfig);
    ensureEntry(tab.id);
    setTabMetaList((prev) => [...prev, tab]);
    try {
      // Populate server-side before activating — activating loads history
      // immediately, and a brand-new api tab's buffer is empty until its
      // first fetch completes.
      await api.fetchTab(tab.id);
    } finally {
      setActiveTab(tab.id);
    }
    return tab;
  }, [ensureEntry, setActiveTab]);

  // "Edit" on an existing remote-query tab: persists the new environment/
  // queryConfig onto the *same* tab (server-side via configureApiTab, same
  // route the picker's "duplicate and modify" flow would use to create a
  // fresh one — /api/tabs/:id/query) rather than creating a new tab, then
  // re-fetches. The server resets that tab's seq counter on reconfigure
  // (a changed query is a different result set, not a continuation — see
  // configureApiTab's own comment), so the client buffer has to be dropped
  // too, same reasoning as handleBootChanged/openInTab: a stale buffer would
  // make the seq<=last.seq dedup guard swallow every line of the new result.
  const updateRemoteTab = useCallback(async (tabId, environment, queryConfig) => {
    const tab = await api.queryTab(tabId, environment, queryConfig);
    const entry = ensureEntry(tabId);
    entry.buffer = [];
    historyLoadedRef.current.delete(tabId);
    setTabMetaList((prev) => prev.map((t) => (t.id === tabId ? tab : t)));
    try {
      await api.fetchTab(tabId);
    } finally {
      setActiveTab(tabId);
    }
    return tab;
  }, [ensureEntry, setActiveTab]);

  const fetchActiveTab = useCallback(async () => {
    const id = activeTabIdRef.current;
    if (!id) return;
    await api.fetchTab(id);
  }, []);

  // Same as fetchActiveTab but for any tab id — used by the tab bar's
  // context menu ("Fetch new" on a background api tab) where the target
  // isn't necessarily the active one.
  const fetchTab = useCallback(async (id) => {
    await api.fetchTab(id);
  }, []);

  const openInTab = useCallback(async (tabId, filePath) => {
    const tab = await api.openFile(tabId, filePath);
    const entry = ensureEntry(tabId);
    entry.buffer = [];
    historyLoadedRef.current.delete(tabId);
    setTabMetaList((prev) => prev.map((t) => (t.id === tabId ? tab : t)));
    await loadHistory(tabId);
    return tab;
  }, [ensureEntry, loadHistory]);

  const activateTab = useCallback(async (tabId) => {
    setActiveTab(tabId);
    setAttentionCounts((prev) => {
      if (!prev[tabId]) return prev;
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    await api.activateTab(tabId);
  }, [setActiveTab]);

  const closeTab = useCallback(async (tabId) => {
    // The server already recomputes its own activeTabId when the closed tab
    // was active (see registry.js) — re-sync from it rather than guessing
    // the next active tab client-side from a state-updater side effect.
    await api.closeTab(tabId);
    buffersRef.current.delete(tabId);
    historyLoadedRef.current.delete(tabId);
    setAttentionCounts((prev) => {
      if (!(tabId in prev)) return prev;
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    const { tabs, active } = await refreshTabList();
    if (activeTabIdRef.current === tabId) {
      setActiveTab(active && tabs.some((t) => t.id === active) ? active : (tabs[0]?.id || null));
    }
  }, [refreshTabList, setActiveTab]);

  // Bulk-close helpers for the tab bar's context menu — implemented as a
  // sequence of individual closeTab calls (each its own server round trip)
  // rather than a dedicated bulk endpoint, since this is a rare action and
  // the server has no bulk-close route to begin with.
  const closeOtherTabs = useCallback(async (keepId) => {
    for (const t of tabMetaList) {
      if (t.id !== keepId) await closeTab(t.id); // eslint-disable-line no-await-in-loop
    }
  }, [tabMetaList, closeTab]);

  const closeTabsToRight = useCallback(async (tabId) => {
    const idx = tabMetaList.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    for (const t of tabMetaList.slice(idx + 1)) {
      await closeTab(t.id); // eslint-disable-line no-await-in-loop
    }
  }, [tabMetaList, closeTab]);

  const clearActiveTab = useCallback(async () => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const entry = ensureEntry(id);
    entry.buffer = [];
    scheduleRender();
    // Clearing is a browser-view-only action per the reference tool's design —
    // don't touch the server's ring buffer here.
  }, [ensureEntry, scheduleRender]);

  // Renders immediately rather than through the rAF-coalesced scheduleRender
  // (unlike handleLine's buffer appends, this isn't a high-frequency path,
  // and batching it is actively harmful for the filter box: FilterInput's
  // own local caret state re-renders synchronously on every keystroke, so a
  // deferred update here would momentarily hand it back the *stale* value,
  // get overwritten into the DOM, then get reasserted a frame later — and
  // that second `.value` write is what resets the caret to the end of the
  // input on every character typed.
  const updateActiveTabUi = useCallback((patch) => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const entry = ensureEntry(id);
    entry.ui = { ...entry.ui, ...patch };
    setRenderTick((t) => t + 1);
  }, [ensureEntry]);

  const toggleExpanded = useCallback((seq) => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const { expandedSeqs } = ensureEntry(id).ui;
    if (expandedSeqs.has(seq)) expandedSeqs.delete(seq);
    else expandedSeqs.add(seq);
    scheduleRender();
  }, [ensureEntry, scheduleRender]);

  const togglePinned = useCallback((seq) => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const { pinnedSeqs } = ensureEntry(id).ui;
    if (pinnedSeqs.has(seq)) pinnedSeqs.delete(seq);
    else pinnedSeqs.add(seq);
    scheduleRender();
  }, [ensureEntry, scheduleRender]);

  // Extra columns are per-tab (not global) — a file tab's dotnet-console
  // logs and a remote-query tab's ES documents rarely share a field schema.
  const addColumn = useCallback((key) => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const entry = ensureEntry(id);
    if (!entry.ui.columns.includes(key)) entry.ui = { ...entry.ui, columns: [...entry.ui.columns, key] };
    scheduleRender();
  }, [ensureEntry, scheduleRender]);

  const removeColumn = useCallback((key) => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const entry = ensureEntry(id);
    entry.ui = { ...entry.ui, columns: entry.ui.columns.filter((k) => k !== key) };
    scheduleRender();
  }, [ensureEntry, scheduleRender]);

  const toggleColumn = useCallback((key) => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const entry = ensureEntry(id);
    const has = entry.ui.columns.includes(key);
    entry.ui = { ...entry.ui, columns: has ? entry.ui.columns.filter((k) => k !== key) : [...entry.ui.columns, key] };
    scheduleRender();
  }, [ensureEntry, scheduleRender]);

  const activeEntry = activeTabId ? ensureEntry(activeTabId) : null;

  return {
    tabMetaList,
    activeTabId,
    activeBuffer: activeEntry?.buffer || [],
    activeUi: activeEntry?.ui || makeDefaultUi(),
    renderTick,
    attentionCounts,
    getLastLineAt,
    openNewTab,
    openInTab,
    activateTab,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    fetchTab,
    clearActiveTab,
    updateActiveTabUi,
    toggleExpanded,
    togglePinned,
    addColumn,
    removeColumn,
    toggleColumn,
    createRemoteTab,
    updateRemoteTab,
    fetchActiveTab,
  };
}
