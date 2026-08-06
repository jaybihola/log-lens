import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, PanelLeft, Braces, FileJson, FolderPlus, FileClock, Command } from 'lucide-react';
import { CommandBar } from '../shared/components/CommandBar.jsx';
import { useCommandBar } from '../shared/hooks/useCommandBar.js';
import { useJsonTabs, isTabDirty } from './hooks/useJsonTabs.js';
import { useJsonFileSystem } from './hooks/useJsonFileSystem.js';
import { useJsonSidebar } from './hooks/useJsonSidebar.js';
import { useContextMenu } from '../shared/hooks/useContextMenu.js';
import { jsonLensApi } from './api/jsonLensClient.js';
import { JsonTabBar } from './components/JsonTabBar.jsx';
import { JsonFileSidebar } from './components/JsonFileSidebar.jsx';
import { JsonToolbar } from './components/JsonToolbar.jsx';
import { JsonTableView } from './components/JsonTableView.jsx';
import { JsonFindBar } from './components/JsonFindBar.jsx';
import { JsonEditor } from '../shared/components/JsonEditor.jsx';
import { ContextMenu } from '../shared/components/ContextMenu.jsx';
import { ConfirmModal } from '../shared/components/ConfirmModal.jsx';
import { PromptModal } from '../shared/components/PromptModal.jsx';
import { FilePickerBody } from '../shared/components/FilePickerBody.jsx';
import { Tooltip } from '../shared/components/Tooltip.jsx';
import { EmptyState } from '../shared/components/EmptyState.jsx';
import {
  filterJsonByFields, findMatchingFieldNames, formatJsonText, minifyJsonText, validateJson,
  escapeJsonString, unescapeJsonString, parseJsonForTable, findTextOccurrences, findJsonMatches,
} from './jsonUtils.js';

const FONT_SIZE_KEY = 'log-lens-json-editor-font-size';
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 20;

function loadFontSize() {
  try {
    const raw = Number(localStorage.getItem(FONT_SIZE_KEY));
    return Number.isFinite(raw) ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, raw)) : 12.5;
  } catch {
    return 12.5;
  }
}

function basename(p) {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

function parentPath(p) {
  const idx = p.lastIndexOf('/');
  return idx <= 0 ? '/' : p.slice(0, idx);
}

// A second, entirely independent tool sharing the app shell — its own tabs
// (useJsonTabs), toolbar, and one CodeMirror editor per active tab. Tabs can
// be plain drafts (autosaved to localStorage only), bound to a real file on
// disk (opened from the folder tree in JsonFileSidebar, saved back with
// Save/Cmd+S), or bound to an app-managed "scratch" (a real file server-side
// under ~/.log-lens-scratches, but never shown as a user-visible file —
// see useJsonFileSystem). Closing a tab with unsaved changes prompts for
// what to do with them rather than silently discarding.
export function JsonFormatterApp({ active, importRequest, onImportHandled }) {
  const {
    tabs, activeTabId, activeTab, addTab, addTabWithContent, closeTab, closeOtherTabs, closeTabsToRight, duplicateTab,
    activateTab, renameTab, setContent, setSelectedFields: setTabSelectedFields,
    openFileTab, openScratchTab, markSaved, revertTab,
  } = useJsonTabs();
  const fs = useJsonFileSystem();
  const { sidebarOpen, toggleSidebar, sidebarWidth, resizeSidebar } = useJsonSidebar();
  const [commandBarOpen, setCommandBarOpen] = useCommandBar(active);
  const [indent, setIndent] = useState(2);
  const [sortKeys, setSortKeys] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [copyStatus, setCopyStatus] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [fontSize, setFontSize] = useState(loadFontSize);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_KEY, String(fontSize)); } catch { /* not fatal */ }
  }, [fontSize]);
  const stepFontSize = (delta) => setFontSize((v) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round((v + delta) * 10) / 10)));

  // Edit vs. View is a real mode boundary, not just a side effect of field
  // selection — kept per tab (so switching tabs restores whichever mode you
  // left it in) but intentionally not persisted anywhere beyond this
  // component's lifetime, unlike `selectedFields`/`content` which live on
  // the tab itself. `viewSubMode` (which read-only rendering to use) is a
  // plain toolbar preference, same tier as `wrap`/`sortKeys` below.
  const [modeByTab, setModeByTab] = useState({});
  const mode = (activeTab && modeByTab[activeTab.id]) || 'edit';
  const setMode = (m) => activeTab && setModeByTab((prev) => ({ ...prev, [activeTab.id]: m }));
  const [viewSubMode, setViewSubMode] = useState('code'); // 'code' | 'table'
  const isViewMode = mode === 'view';

  // Find-in-view: View mode only (both sub-modes), and deliberately not the
  // same thing as the field filter below — this never removes anything, it
  // just highlights matches in whatever's currently displayed and lets you
  // step through them. See JsonFindBar.jsx.
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [findIndex, setFindIndex] = useState(0);
  useEffect(() => { if (!isViewMode) setFindOpen(false); }, [isViewMode]);
  useEffect(() => { setFindOpen(false); }, [activeTabId]);
  useEffect(() => { if (!findOpen) { setFindQuery(''); setFindIndex(0); } }, [findOpen]);
  useEffect(() => { setFindIndex(0); }, [findQuery, findCaseSensitive, viewSubMode]);

  // Field filter: a search box (fuzzy, only applied on Enter) that finds
  // candidate field names, which then get added to `selectedFields` — the
  // exact set actually driving what's shown. Ambiguous searches (more than
  // one distinct matching name) open a picker instead of just guessing.
  // `selectedFields` itself lives on the tab (persisted, like its content)
  // since it's meaningless without the specific document it was built
  // against; the search-in-progress state below is intentionally ephemeral.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNote, setSearchNote] = useState(null); // e.g. "no matches" — cleared on next edit
  const [pendingMatches, setPendingMatches] = useState(null); // null | string[]
  const [pendingSelection, setPendingSelection] = useState(new Set());
  const pickerOptionsRef = useRef(null);
  const { menu, openMenu, closeMenu } = useContextMenu();

  const content = activeTab?.content || '';
  const selectedFields = activeTab?.selectedFields || [];
  const validation = useMemo(() => validateJson(content), [content]);

  // Field-filtering only ever applies in View mode — in Edit mode the tab's
  // `selectedFields` (if any survive from a previous View-mode session)
  // are simply ignored, so Edit mode always shows the real, full, editable
  // content with no filter UI in the way.
  const filterResult = useMemo(
    () => (isViewMode && selectedFields.length ? filterJsonByFields(content, selectedFields, { indent }) : null),
    [isViewMode, content, selectedFields, indent],
  );
  // Only actually swap to the filtered text once we have a real match — an
  // invalid-JSON or no-match state falls back to showing the real content,
  // with a status message explaining why the filter isn't doing anything.
  const isFiltering = !!filterResult?.ok && filterResult.matched;
  const displayedText = isFiltering ? filterResult.resultText : content;
  // View mode is read-only regardless of whether a field filter is active —
  // that's the whole point of the mode boundary (previously this was purely
  // a side effect of `isFiltering`).
  const isReadOnly = isViewMode;
  const dirty = activeTab ? isTabDirty(activeTab) : false;

  // Find matches are computed per sub-mode against whatever's actually
  // displayed (the field-filtered text when a filter's active, same as
  // copy/download already do) — Code sub-mode searches the raw text, Table
  // sub-mode searches the parsed key/value tree so it can highlight cells
  // and auto-expand ancestors rather than just text offsets.
  const trimmedFindQuery = findQuery.trim();
  const codeMatches = useMemo(
    () => (findOpen && viewSubMode === 'code' ? findTextOccurrences(displayedText, trimmedFindQuery, findCaseSensitive) : []),
    [findOpen, viewSubMode, displayedText, trimmedFindQuery, findCaseSensitive],
  );
  const tableParsed = useMemo(
    () => (findOpen && viewSubMode === 'table' ? parseJsonForTable(displayedText) : null),
    [findOpen, viewSubMode, displayedText],
  );
  const tableMatches = useMemo(
    () => (tableParsed?.ok ? findJsonMatches(tableParsed.value, trimmedFindQuery, findCaseSensitive) : []),
    [tableParsed, trimmedFindQuery, findCaseSensitive],
  );
  const findMatchCount = viewSubMode === 'table' ? tableMatches.length : codeMatches.length;
  const clampedFindIndex = findMatchCount ? ((findIndex % findMatchCount) + findMatchCount) % findMatchCount : 0;
  const activeTableMatch = viewSubMode === 'table' && tableMatches.length ? tableMatches[clampedFindIndex] : null;
  const activeCodeRange = viewSubMode === 'code' && codeMatches.length ? codeMatches[clampedFindIndex] : null;

  const gotoFindIndex = (i) => {
    if (!findMatchCount) return;
    setFindIndex(((i % findMatchCount) + findMatchCount) % findMatchCount);
  };

  const addFields = (names) => {
    if (!activeTab) return;
    setTabSelectedFields(activeTab.id, [...selectedFields, ...names.filter((n) => !selectedFields.includes(n))]);
  };

  const runSearch = () => {
    const query = searchQuery.trim();
    if (!query) return;
    const { ok, error, names } = findMatchingFieldNames(content, query);
    if (!ok) { setSearchNote(`Fix the JSON error to search fields: ${error}`); return; }
    if (names.length === 0) { setSearchNote(`No fields match "${query}"`); return; }
    setSearchNote(null);
    if (names.length === 1) {
      addFields(names);
      setSearchQuery('');
      return;
    }
    setPendingMatches(names);
    setPendingSelection(new Set()); // nothing pre-picked — the point is to choose
  };

  // Arrow keys move focus between options (a roving-tabindex-style list);
  // Space toggles the focused one for free, since it's a real <button> —
  // only Enter needs intercepting, since a focused button would otherwise
  // treat it as "toggle" too instead of "confirm the whole picker".
  useEffect(() => {
    if (pendingMatches) pickerOptionsRef.current?.querySelector('button')?.focus();
  }, [pendingMatches]);

  const handlePickerKeyDown = (e) => {
    const container = pickerOptionsRef.current;
    if (!container) return;
    const buttons = Array.from(container.querySelectorAll('button'));
    if (!buttons.length) return;
    const idx = buttons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(idx + 1 + buttons.length) % buttons.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(idx - 1 + buttons.length) % buttons.length].focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmPending();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelPending();
    }
  };

  const togglePending = (name) => {
    setPendingSelection((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
  const confirmPending = () => {
    addFields([...pendingSelection]);
    setPendingMatches(null);
    setSearchQuery('');
  };
  const cancelPending = () => setPendingMatches(null);

  const removeField = (name) => activeTab && setTabSelectedFields(activeTab.id, selectedFields.filter((n) => n !== name));
  const clearFields = () => activeTab && setTabSelectedFields(activeTab.id, []);

  const handleChipContextMenu = (e, name) => {
    openMenu(e, [
      { label: 'Copy field name', onClick: () => navigator.clipboard.writeText(name) },
      { label: 'Remove', onClick: () => removeField(name), danger: true },
      { divider: true },
      { label: 'Clear all fields', onClick: clearFields, danger: true },
    ]);
  };

  const runTransform = (fn) => {
    if (!activeTab) return;
    try {
      const next = fn(content, { indent, sortKeys });
      setContent(activeTab.id, next);
    } catch { /* invalid JSON — the validation banner already explains why */ }
  };

  const format = () => runTransform(formatJsonText);
  const minify = () => runTransform(minifyJsonText);
  const escapeString = () => runTransform(escapeJsonString);
  const unescapeString = () => runTransform(unescapeJsonString);

  const requestGotoLine = () => activeTab && setDialog({ type: 'goto-line' });

  const copy = async () => {
    if (!activeTab) return;
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Copy failed');
    }
    setTimeout(() => setCopyStatus(null), 1500);
  };

  const download = () => {
    if (!activeTab) return;
    const blob = new Blob([displayedText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = activeTab.name.trim().replace(/\.json$/i, '') || 'untitled';
    a.href = url;
    a.download = `${base}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeTab) return;
    const text = await file.text();
    setContent(activeTab.id, text);
    renameTab(activeTab.id, file.name);
  };

  const clear = () => activeTab && setContent(activeTab.id, '');

  // ---- save / save-as / close flows ----

  const writeFileAndMark = async (tab, filePath, thenClose) => {
    try {
      await jsonLensApi.writeFile(filePath, tab.content);
      markSaved(tab.id, { origin: 'file', filePath, scratchId: null, name: basename(filePath), content: tab.content });
      fs.refreshFolder(parentPath(filePath));
      setDialog(null);
      if (thenClose) closeTab(tab.id);
    } catch (e) {
      setDialog({ type: 'error', message: e.message });
    }
  };

  const handleSaveAsConfirm = async (tab, filePath, thenClose) => {
    try {
      const { exists } = await jsonLensApi.fileExists(filePath);
      if (exists) { setDialog({ type: 'confirm-overwrite', tab, filePath, thenClose }); return; }
      await writeFileAndMark(tab, filePath, thenClose);
    } catch (e) {
      setDialog({ type: 'error', message: e.message });
    }
  };

  // The empty-state's own "reopen this scratch" list has no existing tab to
  // fall back on for content the way JsonFileSidebar's rows do — it's only
  // ever shown when there are zero tabs — so it always reads fresh.
  const openScratchFromEmptyState = async (scratch) => {
    try {
      const { content } = await jsonLensApi.readScratch(scratch.id);
      openScratchTab(scratch.id, scratch.name, content);
    } catch (e) {
      setDialog({ type: 'error', message: e.message });
    }
  };

  const saveTabAsScratch = async (tab, thenClose) => {
    try {
      const entry = await fs.createScratch(tab.name, tab.content);
      markSaved(tab.id, { origin: 'scratch', scratchId: entry.id, filePath: null, name: entry.name, content: tab.content });
      setDialog(null);
      if (thenClose) closeTab(tab.id);
    } catch (e) {
      setDialog({ type: 'error', message: e.message });
    }
  };

  const saveTab = async (tab, thenClose = false) => {
    if (tab.origin === 'file') {
      try {
        await jsonLensApi.writeFile(tab.filePath, tab.content);
        markSaved(tab.id, { content: tab.content });
        setDialog(null);
        if (thenClose) closeTab(tab.id);
      } catch (e) {
        setDialog({ type: 'error', message: e.message });
      }
      return;
    }
    if (tab.origin === 'scratch') {
      try {
        await fs.saveScratchContent(tab.scratchId, tab.content);
        markSaved(tab.id, { content: tab.content });
        setDialog(null);
        if (thenClose) closeTab(tab.id);
      } catch (e) {
        setDialog({ type: 'error', message: e.message });
      }
      return;
    }
    // 'new' tabs have no in-place destination yet — Save behaves like Save As.
    setDialog({ type: 'save-as', tab, thenClose });
  };

  const requestCloseTab = (tab) => {
    if (!isTabDirty(tab)) { closeTab(tab.id); return; }
    setDialog({ type: tab.origin === 'new' ? 'close-new' : 'close-bound', tab });
  };

  const requestCloseOthers = (keepId) => {
    const toClose = tabs.filter((t) => t.id !== keepId);
    const dirtyCount = toClose.filter(isTabDirty).length;
    if (dirtyCount === 0) { closeOtherTabs(keepId); return; }
    setDialog({
      type: 'bulk-discard',
      message: `${dirtyCount} other tab${dirtyCount === 1 ? '' : 's'} ${dirtyCount === 1 ? 'has' : 'have'} unsaved changes that will be discarded.`,
      onConfirm: () => { closeOtherTabs(keepId); setDialog(null); },
    });
  };

  const requestCloseToRight = (id) => {
    const idx = tabs.findIndex((t) => t.id === id);
    const dirtyCount = tabs.slice(idx + 1).filter(isTabDirty).length;
    if (dirtyCount === 0) { closeTabsToRight(id); return; }
    setDialog({
      type: 'bulk-discard',
      message: `${dirtyCount} tab${dirtyCount === 1 ? '' : 's'} to the right ${dirtyCount === 1 ? 'has' : 'have'} unsaved changes that will be discarded.`,
      onConfirm: () => { closeTabsToRight(id); setDialog(null); },
    });
  };

  // ⌘K command bar — same principle as Log Lens's: every entry wraps a
  // handler that already exists for some button/popover elsewhere in this
  // file, so there's exactly one source of truth per action. Entries that
  // wouldn't currently apply are left out rather than shown disabled.
  const commands = useMemo(() => {
    const list = [
      { id: 'new-tab', label: 'New blank tab', group: 'Tabs', onRun: addTab },
      { id: 'open-file', label: 'Open file…', group: 'Tabs', onRun: () => setDialog({ type: 'open-file' }) },
      { id: 'add-folder', label: 'Add folder…', group: 'Tabs', onRun: () => setDialog({ type: 'add-folder' }) },
    ];
    tabs.filter((t) => t.id !== activeTabId).forEach((t) => {
      list.push({ id: `switch-${t.id}`, label: `Switch to: ${t.name}`, group: 'Tabs', onRun: () => activateTab(t.id) });
    });
    if (activeTab) {
      list.push({ id: 'close-tab', label: 'Close current tab', group: 'Tabs', onRun: () => requestCloseTab(activeTab) });
    }

    list.push({ id: 'toggle-sidebar', label: sidebarOpen ? 'Hide files sidebar' : 'Show files sidebar', group: 'View', onRun: toggleSidebar });
    if (activeTab) {
      list.push({ id: 'toggle-mode', label: `Switch to ${mode === 'edit' ? 'View' : 'Edit'} mode`, group: 'View', onRun: () => setMode(mode === 'edit' ? 'view' : 'edit') });
      if (isViewMode) {
        list.push(
          { id: 'view-code', label: 'Code view', group: 'View', onRun: () => setViewSubMode('code') },
          { id: 'view-table', label: 'Table view', group: 'View', onRun: () => setViewSubMode('table') },
        );
      }
      list.push(
        { id: 'toggle-wrap', label: wrap ? 'Disable wrap lines' : 'Enable wrap lines', group: 'View', onRun: () => setWrap((v) => !v) },
        { id: 'toggle-sort', label: sortKeys ? 'Disable sort keys' : 'Enable sort keys', group: 'View', onRun: () => setSortKeys((v) => !v) },
        { id: 'zoom-in', label: 'Zoom in', group: 'View', onRun: () => stepFontSize(1) },
        { id: 'zoom-out', label: 'Zoom out', group: 'View', onRun: () => stepFontSize(-1) },
        { id: 'find', label: isViewMode ? 'Find in view' : 'Find / Replace', group: 'Edit', shortcut: '⌘F', onRun: () => (isViewMode ? setFindOpen((v) => !v) : editorRef.current?.find()) },
        { id: 'goto-line', label: 'Go to line…', group: 'Edit', onRun: requestGotoLine },
        { id: 'fold-all', label: 'Fold all', group: 'Edit', onRun: () => editorRef.current?.foldAll() },
        { id: 'unfold-all', label: 'Unfold all', group: 'Edit', onRun: () => editorRef.current?.unfoldAll() },
      );
      if (displayedText.trim()) list.push({ id: 'copy', label: 'Copy', group: 'Edit', onRun: copy });
      list.push({ id: 'download', label: 'Download', group: 'Edit', onRun: download });

      if (mode === 'edit') {
        if (dirty) list.push({ id: 'save', label: 'Save', group: 'Edit', shortcut: '⌘S', onRun: () => saveTab(activeTab) });
        list.push(
          { id: 'save-as', label: 'Save as…', group: 'Edit', onRun: () => setDialog({ type: 'save-as', tab: activeTab }) },
          { id: 'import', label: 'Import file…', group: 'Edit', onRun: () => fileInputRef.current?.click() },
          { id: 'undo', label: 'Undo', group: 'Edit', onRun: () => editorRef.current?.undo() },
          { id: 'redo', label: 'Redo', group: 'Edit', onRun: () => editorRef.current?.redo() },
        );
        if (content.trim() && validation.valid) {
          list.push(
            { id: 'format', label: 'Format', group: 'Edit', onRun: format },
            { id: 'minify', label: 'Minify', group: 'Edit', onRun: minify },
          );
        }
        if (content.trim()) {
          list.push(
            { id: 'escape', label: 'Escape (wrap as string)', group: 'Edit', onRun: escapeString },
            { id: 'unescape', label: 'Unescape (decode string)', group: 'Edit', onRun: unescapeString },
            { id: 'clear', label: 'Clear', group: 'Edit', onRun: clear },
          );
        }
        list.push(
          { id: 'indent-2', label: 'Set indent: 2 spaces', group: 'Indent', onRun: () => setIndent(2) },
          { id: 'indent-4', label: 'Set indent: 4 spaces', group: 'Indent', onRun: () => setIndent(4) },
          { id: 'indent-tab', label: 'Set indent: Tab', group: 'Indent', onRun: () => setIndent('tab') },
        );
      }
    }
    return list;
  }, [
    tabs, activeTabId, activeTab, sidebarOpen, mode, isViewMode, wrap, sortKeys, dirty, content, validation,
    displayedText, toggleSidebar, activateTab, requestCloseTab, copy, download, format, minify,
    escapeString, unescapeString, clear, requestGotoLine, saveTab,
  ]);

  // Cmd/Ctrl+S saves the active tab — gated on `active` since JSON Lens stays
  // mounted (state-preserving) even while Log Lens is the one on screen.
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeTab && isTabDirty(activeTab)) saveTab(activeTab);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd/Ctrl+F opens the find-in-view bar — only in View mode, where it's
  // the only find affordance (Edit mode keeps CodeMirror's own find/replace,
  // bound to its own keymap on the editor itself). Capture phase + explicit
  // stopPropagation so this wins over CodeMirror's default search keymap
  // when the read-only editor happens to have focus.
  useEffect(() => {
    if (!active || !isViewMode) return undefined;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        setFindOpen(true);
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [active, isViewMode]);

  // "Send to JSON Lens" from a Log Lens line — App.jsx queues one of these
  // and switches mode; consumed here as a fresh draft tab, then immediately
  // cleared so it can't re-fire (e.g. on an unrelated re-render).
  useEffect(() => {
    if (!importRequest) return;
    addTabWithContent(importRequest.content, importRequest.name);
    onImportHandled();
  }, [importRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">JSON Lens</span>
        <JsonTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onActivate={activateTab}
          onRequestClose={requestCloseTab}
          onAdd={addTab}
          onRename={renameTab}
          onDuplicate={duplicateTab}
          onRevert={revertTab}
          onCloseOthers={requestCloseOthers}
          onCloseToRight={requestCloseToRight}
        />
        <div className="app-header-actions">
          <Tooltip label="Command bar" description="Search and run any action by typing. (⌘K)">
            <button type="button" className="icon-btn" onClick={() => setCommandBarOpen(true)}>
              <Command size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Files sidebar" description="Browse opened folders and saved scratches.">
            <button type="button" className={sidebarOpen ? 'active icon-btn' : 'icon-btn'} onClick={toggleSidebar}>
              <PanelLeft size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>
      </header>

      <div className="app-body">
        {sidebarOpen && (
          <JsonFileSidebar
            fs={fs}
            tabs={tabs}
            activeTabId={activeTabId}
            onOpenFile={openFileTab}
            onOpenScratch={openScratchTab}
            onFileRenamed={(oldPath, newPath) => {
              const t = tabs.find((x) => x.origin === 'file' && x.filePath === oldPath);
              if (t) markSaved(t.id, { filePath: newPath, name: basename(newPath) });
            }}
            onFileDeleted={(filePath) => {
              const t = tabs.find((x) => x.origin === 'file' && x.filePath === filePath);
              if (t) markSaved(t.id, { origin: 'new', filePath: null, name: `${t.name} (deleted)` });
            }}
            onScratchRenamed={(id, name) => {
              const t = tabs.find((x) => x.origin === 'scratch' && x.scratchId === id);
              if (t) markSaved(t.id, { name });
            }}
            onScratchDeleted={(id) => {
              const t = tabs.find((x) => x.origin === 'scratch' && x.scratchId === id);
              if (t) markSaved(t.id, { origin: 'new', scratchId: null, name: `${t.name} (deleted)` });
            }}
            width={sidebarWidth}
            onResize={resizeSidebar}
          />
        )}

        <div className="app-main">
          {tabs.length === 0 ? (
            <EmptyState
              icon={<Braces size={40} strokeWidth={1.25} />}
              title="No tab open"
              subtitle="Start a blank draft, open a .json file from disk, or pick up a saved scratch."
              actions={[
                { label: 'New blank tab', icon: <Plus size={14} strokeWidth={1.75} />, primary: true, onClick: addTab },
                { label: 'Open file…', icon: <FileJson size={14} strokeWidth={1.75} />, onClick: () => setDialog({ type: 'open-file' }) },
                { label: 'Add folder…', icon: <FolderPlus size={14} strokeWidth={1.75} />, onClick: () => setDialog({ type: 'add-folder' }) },
              ]}
              listTitle={fs.scratches.length ? 'Scratches' : undefined}
              listItems={fs.scratches.map((s) => ({
                key: s.id,
                label: s.name,
                icon: <FileClock size={13} strokeWidth={1.75} />,
                onClick: () => openScratchFromEmptyState(s),
              }))}
            />
          ) : (
            <>
          <JsonToolbar
            activeTab={activeTab}
            mode={mode}
            onSetMode={setMode}
            isViewMode={isViewMode}
            viewSubMode={viewSubMode}
            onSetViewSubMode={setViewSubMode}
            dirty={dirty}
            content={content}
            displayedText={displayedText}
            validation={validation}
            onSave={() => activeTab && saveTab(activeTab)}
            onSaveAs={() => activeTab && setDialog({ type: 'save-as', tab: activeTab })}
            fileInputRef={fileInputRef}
            onImportFile={handleFilePicked}
            onDownload={download}
            onUndo={() => editorRef.current?.undo()}
            onRedo={() => editorRef.current?.redo()}
            findOpen={findOpen}
            onToggleFind={() => (isViewMode ? setFindOpen((v) => !v) : editorRef.current?.find())}
            onGotoLine={requestGotoLine}
            onFormat={format}
            onMinify={minify}
            sortKeys={sortKeys}
            onToggleSortKeys={() => setSortKeys((v) => !v)}
            onEscape={escapeString}
            onUnescape={unescapeString}
            indent={indent}
            onIndentChange={setIndent}
            wrap={wrap}
            onToggleWrap={() => setWrap((v) => !v)}
            onFoldAll={() => editorRef.current?.foldAll()}
            onUnfoldAll={() => editorRef.current?.unfoldAll()}
            fontSize={fontSize}
            minFontSize={MIN_FONT_SIZE}
            maxFontSize={MAX_FONT_SIZE}
            onStepFontSize={stepFontSize}
            copyStatus={copyStatus}
            onCopy={copy}
            onClear={clear}
          />

          {isViewMode && (
            <div className="json-field-filter">
              <div className="json-field-search-row">
                <div className="json-field-search-wrap">
                  <input
                    type="text"
                    className="json-field-filter-input"
                    placeholder='Search fields (fuzzy), Enter to add — e.g. "usr" finds userName'
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchNote(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
                  />
                  {pendingMatches && (
                    <div className="json-field-picker">
                      <p className="json-field-picker-hint">{`"${searchQuery.trim()}" matches multiple fields — pick which to include:`}</p>
                      <div
                        className="json-field-picker-options"
                        ref={pickerOptionsRef}
                        onKeyDown={handlePickerKeyDown}
                      >
                        {pendingMatches.map((name) => (
                          <button
                            key={name}
                            type="button"
                            className={pendingSelection.has(name) ? 'view-menu-toggle active' : 'view-menu-toggle'}
                            onClick={() => togglePending(name)}
                          >
                            <span>{name}</span>
                            <span className="view-menu-toggle-indicator" />
                          </button>
                        ))}
                      </div>
                      <p className="json-field-picker-keys">
                        <kbd>↑↓</kbd> move  <kbd>Space</kbd> toggle  <kbd>Enter</kbd> confirm  <kbd>Esc</kbd> cancel
                      </p>
                      <div className="json-field-picker-actions">
                        <button type="button" onClick={cancelPending}>Cancel</button>
                        <button type="button" disabled={pendingSelection.size === 0} onClick={confirmPending}>Add selected</button>
                      </div>
                    </div>
                  )}
                </div>
                <Tooltip label="Add field" description="Search for a field name (fuzzy) and add it to the filter.">
                  <button type="button" className="icon-btn" onClick={runSearch} disabled={!searchQuery.trim()}>
                    <Plus size={15} strokeWidth={1.75} />
                  </button>
                </Tooltip>
                {selectedFields.length > 0 && (
                  <div className="json-field-chips">
                    {selectedFields.map((name) => (
                      <span className="preset-chip" key={name} onContextMenu={(e) => handleChipContextMenu(e, name)}>
                        <span className="preset-name">{name}</span>
                        <button type="button" onClick={() => removeField(name)}>×</button>
                      </span>
                    ))}
                    <button type="button" className="json-field-chips-clear" onClick={clearFields}>Clear all</button>
                  </div>
                )}
                {(searchNote || isFiltering) && (
                  <span className="json-field-filter-status">
                    {searchNote || `Showing ${selectedFields.length} field${selectedFields.length === 1 ? '' : 's'} (read-only)`}
                  </span>
                )}
              </div>
            </div>
          )}

          {isViewMode && findOpen && (
            <JsonFindBar
              query={findQuery}
              onQueryChange={setFindQuery}
              caseSensitive={findCaseSensitive}
              onToggleCaseSensitive={() => setFindCaseSensitive((v) => !v)}
              matchCount={findMatchCount}
              currentIndex={clampedFindIndex}
              onNext={() => gotoFindIndex(clampedFindIndex + 1)}
              onPrev={() => gotoFindIndex(clampedFindIndex - 1)}
              onClose={() => setFindOpen(false)}
            />
          )}

          <div className="json-editor-body">
            {activeTab && isViewMode && viewSubMode === 'table' ? (
              <JsonTableView
                text={displayedText}
                matches={tableMatches}
                activeMatch={activeTableMatch}
                query={trimmedFindQuery}
                caseSensitive={findCaseSensitive}
              />
            ) : activeTab && (
              <JsonEditor
                ref={editorRef}
                value={displayedText}
                onChange={isReadOnly ? undefined : (v) => setContent(activeTab.id, v)}
                readOnly={isReadOnly}
                wrap={wrap}
                fontSize={fontSize}
                height="100%"
                highlightRanges={isViewMode && viewSubMode === 'code' ? codeMatches : undefined}
                activeHighlightRange={activeCodeRange}
              />
            )}
          </div>
            </>
          )}
        </div>
      </div>

      {dialog?.type === 'open-file' && (
        <div className="modal-overlay" onClick={() => setDialog(null)}>
          <div className="modal picker-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Open file</h3>
            <FilePickerBody
              mode="open-file"
              browseFn={jsonLensApi.browse}
              onOpen={async (filePath) => {
                try {
                  const { content } = await jsonLensApi.readFile(filePath);
                  openFileTab(filePath, content);
                  setDialog(null);
                } catch (e) {
                  setDialog({ type: 'error', message: e.message });
                }
              }}
              onClose={() => setDialog(null)}
            />
          </div>
        </div>
      )}

      {dialog?.type === 'add-folder' && (
        <div className="modal-overlay" onClick={() => setDialog(null)}>
          <div className="modal picker-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add folder</h3>
            <FilePickerBody
              mode="choose-folder"
              browseFn={jsonLensApi.browse}
              onOpen={(dir) => { fs.addRoot(dir); setDialog(null); }}
              onClose={() => setDialog(null)}
            />
          </div>
        </div>
      )}

      {dialog?.type === 'save-as' && (
        <div className="modal-overlay" onClick={() => setDialog(null)}>
          <div className="modal picker-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Save as</h3>
            <FilePickerBody
              mode="save-file"
              browseFn={jsonLensApi.browse}
              initialFileName={dialog.tab.name.toLowerCase().endsWith('.json') ? dialog.tab.name : `${dialog.tab.name}.json`}
              onOpen={(filePath) => handleSaveAsConfirm(dialog.tab, filePath, dialog.thenClose)}
              onClose={() => setDialog(null)}
            />
          </div>
        </div>
      )}

      {dialog?.type === 'confirm-overwrite' && (
        <ConfirmModal
          title="Overwrite file?"
          message={`"${basename(dialog.filePath)}" already exists. Overwrite it?`}
          actions={[{ label: 'Overwrite', danger: true, onClick: () => writeFileAndMark(dialog.tab, dialog.filePath, dialog.thenClose) }]}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === 'close-new' && (
        <ConfirmModal
          title="Unsaved tab"
          message={`"${dialog.tab.name}" hasn't been saved to disk. What would you like to do?`}
          actions={[
            { label: 'Discard', danger: true, onClick: () => { closeTab(dialog.tab.id); setDialog(null); } },
            { label: 'Save as scratch', onClick: () => saveTabAsScratch(dialog.tab, true) },
            { label: 'Save to file…', onClick: () => setDialog({ type: 'save-as', tab: dialog.tab, thenClose: true }) },
          ]}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === 'close-bound' && (
        <ConfirmModal
          title="Unsaved changes"
          message={`"${dialog.tab.name}" has unsaved changes. Save before closing?`}
          actions={[
            { label: 'Discard changes', danger: true, onClick: () => { closeTab(dialog.tab.id); setDialog(null); } },
            { label: 'Save', onClick: () => saveTab(dialog.tab, true) },
          ]}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === 'bulk-discard' && (
        <ConfirmModal
          title="Discard unsaved changes?"
          message={dialog.message}
          actions={[{ label: 'Discard and close', danger: true, onClick: dialog.onConfirm }]}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === 'goto-line' && (
        <PromptModal
          title="Go to line"
          placeholder="Line number"
          confirmLabel="Go"
          onCancel={() => setDialog(null)}
          onConfirm={(value) => {
            const n = parseInt(value, 10);
            if (Number.isFinite(n)) editorRef.current?.gotoLine(n);
            setDialog(null);
          }}
        />
      )}

      {dialog?.type === 'error' && (
        <ConfirmModal title="Something went wrong" message={dialog.message} actions={[]} cancelLabel="OK" onCancel={() => setDialog(null)} />
      )}

      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
      <CommandBar open={commandBarOpen} onClose={() => setCommandBarOpen(false)} commands={commands} />
    </div>
  );
}
