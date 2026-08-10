import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeft, Settings, Moon, Sun, HelpCircle, ScrollText, FileText, Radio, Clock, Layers, Command } from 'lucide-react';
import { CommandBar } from '../shared/components/CommandBar.jsx';
import { useCommandBar } from '../shared/hooks/useCommandBar.js';
import { useTabs } from './hooks/useTabs.js';
import { useDisplaySettings } from './hooks/useDisplaySettings.js';
import { usePresets } from './hooks/usePresets.js';
import { useRecentFiles } from './hooks/useRecentFiles.js';
import { useTabGroups } from './hooks/useTabGroups.js';
import { useColumnWidths } from './hooks/useColumnWidths.js';
import { useTheme } from '../shell/useTheme.js';
import { useIndexFields } from './hooks/useIndexFields.js';
import { useFieldsSidebar } from './hooks/useFieldsSidebar.js';
import { useFilterMode } from './hooks/useFilterMode.js';
import { useTitleAttention } from './hooks/useTitleAttention.js';
import { resolveJumpTarget } from './render/timestamp.js';
import { TabBar } from './components/TabBar.jsx';
import { TabPickerModal } from './components/TabPickerModal.jsx';
import { RemoteQueryEditModal } from './components/RemoteQueryEditModal.jsx';
import { PreferencesModal } from './components/preferences/PreferencesModal.jsx';
import { HelpPanel } from './components/HelpPanel.jsx';
import { TabGroupsMenu } from './components/TabGroupsMenu.jsx';
import { Popover } from '../shared/components/Popover.jsx';
import { Tooltip } from '../shared/components/Tooltip.jsx';
import { Toolbar } from './components/Toolbar.jsx';
import { TimeHistogram } from './components/TimeHistogram.jsx';
import { EntryView } from './components/EntryView.jsx';
import { FieldsSidebar } from './components/FieldsSidebar.jsx';
import { EmptyState } from '../shared/components/EmptyState.jsx';

function basename(p) {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

export function LogViewerApp({ active, onSendToJsonLens }) {
  const {
    tabMetaList, activeTabId, activeBuffer, activeUi, attentionCounts, getLastLineAt,
    openNewTab, openInTab, activateTab, closeTab, closeOtherTabs, closeTabsToRight, fetchTab, clearActiveTab, updateActiveTabUi,
    toggleExpanded, togglePinned, addColumn, removeColumn, toggleColumn, createRemoteTab, updateRemoteTab, fetchActiveTab,
  } = useTabs();
  const { fontSize, stepFontSize, histogramOpen, toggleHistogram, histogramIntervalMs, setHistogramInterval } = useDisplaySettings();
  const { presets, savePreset, removePreset } = usePresets();
  const { recentFiles, addRecent, removeRecent } = useRecentFiles();
  const { groups, saveGroup, renameGroup, removeGroup } = useTabGroups();
  const { tsWidth, badgeWidth, extraColumnWidth, setColumnWidth } = useColumnWidths();
  const { theme, setTheme, toggleTheme } = useTheme();
  const { sidebarOpen, toggleSidebar, sidebarWidth, resizeSidebar } = useFieldsSidebar();
  const { filterMode, toggleFilterMode } = useFilterMode();
  const [commandBarOpen, setCommandBarOpen] = useCommandBar(active);

  // Background-tab attention: flash the browser tab title while any Log
  // Lens tab has unseen error/warn lines (see useTabs.js/TabBar.jsx for the
  // per-tab badge half of this).
  useTitleAttention(useMemo(() => Object.values(attentionCounts).reduce((sum, n) => sum + n, 0), [attentionCounts]));

  const [modal, setModal] = useState(null); // null | 'picker' | 'preferences' | 'remote-edit'
  const [pickerMode, setPickerMode] = useState('file');
  // Seeds RemoteQueryEditModal — { mode: 'create' | 'edit', initialConfig }.
  // 'create' backs "Duplicate and modify" (a new tab); 'edit' backs "Edit…"
  // (reconfigures the source tab in place via updateRemoteTab).
  const [remoteEdit, setRemoteEdit] = useState(null);
  // Field:value clauses staged from FieldTable's per-row "fetch new tab"
  // buttons (see handleToggleStagedFilter) — accumulated across as many
  // fields/rows as wanted (even across expanding/collapsing different rows)
  // before actually creating the new tab, unlike Filter for/out right next
  // to them which apply immediately. [{ field, value, negate }].
  const [stagedFilters, setStagedFilters] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const filterInputRef = useRef(null);
  const entryViewRef = useRef(null);
  // Bumped after every query run so useIndexFields re-reads the accumulated
  // field cache — fields are now derived from hits, so a re-fetch (e.g. a
  // widened date range) can surface newly-observed fields without switching
  // tabs away and back.
  const [fieldsRefreshToken, setFieldsRefreshToken] = useState(0);

  const activeTab = tabMetaList.find((t) => t.id === activeTabId) || null;
  const indexFields = useIndexFields(activeTab?.environment, activeTab?.queryConfig?.index, fieldsRefreshToken);
  // Staged filters are scoped to whatever tab they were staged from (its
  // fields, its request) — switching away makes them stale, so drop them
  // rather than let them silently apply against a different tab's schema.
  useEffect(() => {
    setStagedFilters([]);
  }, [activeTabId]);
  const exportLabel = activeTab
    ? (activeTab.kind === 'api' ? (activeTab.environment || 'remote-query') : basename(activeTab.file || 'log'))
    : 'log-lens';
  const closeModal = () => { setModal(null); setRemoteEdit(null); };
  const openPicker = (mode) => { setPickerMode(mode); setModal('picker'); };

  const handleFileOpen = async (path) => {
    await openNewTab(path);
    addRecent(path);
    closeModal();
  };

  // Multi-select file open (picker's "Open N selected") and tab-group reopen
  // both just loop createTab-per-path — sequential, so a stack of 5 files
  // opens as 5 ordered tabs rather than racing.
  const handleFilesOpen = async (paths) => {
    for (const path of paths) {
      await openNewTab(path); // eslint-disable-line no-await-in-loop
      addRecent(path);
    }
    closeModal();
  };

  // File-tab paths currently open — what "save current tabs as a group"
  // captures. Remote-query tabs have no path, so they're left out of groups.
  const openFilePaths = tabMetaList.filter((t) => t.kind === 'file' && t.file).map((t) => t.file);

  // Tab bar context menu's "Reload"/"Fetch new" — a file tab re-tails the
  // same path from scratch, an api tab just re-runs its last query.
  const handleReloadTab = async (tab) => {
    if (tab.kind === 'api') await fetchTab(tab.id);
    else if (tab.file) await openInTab(tab.id, tab.file);
  };

  // Tab bar context menu's three remote-query actions:
  // "Duplicate" — no modal, just re-runs the exact same config as a new tab.
  const handleDuplicateTab = (tab) => createRemoteTab(tab.environment, tab.queryConfig);
  // "Duplicate and modify…" — same as above but via the modal, pre-filled,
  // so it can be changed before creating the new tab.
  const openDuplicateModify = (tab) => {
    setRemoteEdit({ mode: 'create', initialConfig: { environment: tab.environment, ...tab.queryConfig } });
    setModal('remote-edit');
  };
  // "Edit…" — same modal/pre-fill, but reconfigures this tab in place
  // (updateRemoteTab) instead of creating a new one.
  const openEditRemoteTab = (tab) => {
    setRemoteEdit({ mode: 'edit', initialConfig: { tabId: tab.id, environment: tab.environment, ...tab.queryConfig } });
    setModal('remote-edit');
  };

  const handleFetch = async () => {
    setFetching(true);
    try {
      await fetchActiveTab();
      setFieldsRefreshToken((n) => n + 1);
    } finally {
      setFetching(false);
    }
  };

  const handleJumpQuery = (query) => {
    const seq = resolveJumpTarget(activeBuffer, query);
    if (seq === null) return false;
    return entryViewRef.current?.scrollToSeq(seq) ?? false;
  };

  // Applying a value from the fields sidebar's top-values popover — appends
  // a `field:value` JQL token to whatever's already in the filter box
  // (quoting the value if it has whitespace/parens/quotes the tokenizer
  // would otherwise choke on) rather than clobbering an in-progress query.
  const handleApplyFieldFilter = (field, value, negate = false) => {
    const needsQuotes = /[\s"()]/.test(value) || value === '';
    const token = `${negate ? '-' : ''}${field}:${needsQuotes ? `"${value}"` : value}`;
    const current = activeUi.filterQuery.trim();
    updateActiveTabUi({ filterQuery: current ? `${current} ${token}` : token });
    filterInputRef.current?.focus();
  };

  // FieldTable's "Fetch new tab: for/excluding this value" pair — the
  // KQL-fetch counterparts of handleApplyFieldFilter's Filter for/out right
  // next to them (same signature: field, value, negate). Unlike those,
  // which apply immediately, these *stage* the clause (toggle it into/out
  // of stagedFilters) so several fields — even from different rows, expanded
  // one at a time — can be combined before actually creating anything.
  const handleToggleStagedFilter = (field, value, negate = false) => {
    setStagedFilters((prev) => {
      const idx = prev.findIndex((f) => f.field === field && f.value === value && f.negate === negate);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      return [...prev, { field, value, negate }];
    });
  };
  const removeStagedFilter = (index) => setStagedFilters((prev) => prev.filter((_, i) => i !== index));
  const clearStagedFilters = () => setStagedFilters([]);

  // The staged-filters bar's "Create new tab" — clones the active
  // remote-query tab's exact request (environment, index, time range, fold
  // values, raw body override) into a *new* tab with every staged
  // field:value clause ANDed onto its existing KQL, then opens the picker
  // modal pre-filled so it can be reviewed/adjusted before creating the new
  // tab — same "clone the request, tweak the filter" idea as "Duplicate and
  // modify…", just seeded from staged log-entry field values instead of the
  // source tab's filter as-is. Only reachable when the active tab is
  // kind === 'api' (the bar itself is gated on that — see its render below)
  // — a file tab has no "request" to clone.
  const handleCreateStagedTab = () => {
    if (!activeTab || activeTab.kind !== 'api' || !stagedFilters.length) return;
    const quote = (v) => (/[\s"()]/.test(v) || v === '' ? `"${v}"` : v);
    const clauses = stagedFilters.map(({ field, value, negate }) => `${negate ? '-' : ''}${field}:${quote(value)}`).join(' ');
    const existingKql = (activeTab.queryConfig?.kql || '').trim();
    setRemoteEdit({
      mode: 'create',
      initialConfig: {
        environment: activeTab.environment,
        ...activeTab.queryConfig,
        kql: [existingKql, clauses].filter(Boolean).join(' '),
        // A raw-body override, if the source tab had one, wins over kql at
        // query time — carrying it over here would silently make the staged
        // filters a no-op, defeating the whole point of this action.
        rawBody: null,
      },
    });
    setModal('remote-edit');
    setStagedFilters([]);
  };

  // ⌘K command bar — every command here is a thin wrapper around a handler
  // that already exists for some button/popover elsewhere in this file, so
  // there's exactly one source of truth per action. Entries whose action
  // wouldn't currently apply (no tab open, wrong tab kind, etc.) are left
  // out entirely rather than shown disabled, matching how the real toolbar
  // already hides e.g. Fetch on a non-remote-query tab.
  const commands = useMemo(() => {
    const list = [
      { id: 'open-file', label: 'Open file…', group: 'Tabs', keywords: 'open new tail', onRun: () => openPicker('file') },
      { id: 'open-remote', label: 'Remote query…', group: 'Tabs', keywords: 'open new elasticsearch opensearch', onRun: () => openPicker('api') },
    ];
    tabMetaList.filter((t) => t.id !== activeTabId).forEach((t) => {
      const label = t.kind === 'api' ? (t.environment || 'remote query') : basename(t.file || 'log');
      list.push({ id: `switch-${t.id}`, label: `Switch to: ${label}`, group: 'Tabs', onRun: () => activateTab(t.id) });
    });
    if (activeTab) {
      list.push({ id: 'close-tab', label: 'Close current tab', group: 'Tabs', onRun: () => closeTab(activeTab.id) });
    }

    list.push(
      { id: 'toggle-sidebar', label: sidebarOpen ? 'Hide fields sidebar' : 'Show fields sidebar', group: 'View', onRun: toggleSidebar },
      { id: 'toggle-theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, group: 'View', onRun: toggleTheme },
      { id: 'preferences', label: 'Preferences…', group: 'View', keywords: 'settings environments credentials', onRun: () => setModal('preferences') },
    );
    if (activeTab) {
      list.push(
        { id: 'toggle-histogram', label: histogramOpen ? 'Hide time histogram' : 'Show time histogram', group: 'View', onRun: toggleHistogram },
        { id: 'toggle-filter-mode', label: filterMode === 'visual' ? 'Switch to text filter' : 'Visual filter builder', group: 'View', onRun: toggleFilterMode },
      );
    }

    if (activeTab) {
      if (activeTab.kind === 'api') {
        list.push({ id: 'fetch', label: 'Fetch new', group: 'Log', keywords: 'refresh reload run query', onRun: handleFetch });
      } else {
        list.push({ id: 'toggle-autoscroll', label: activeUi.autoscroll ? 'Disable autoscroll' : 'Enable autoscroll', group: 'Log', onRun: () => updateActiveTabUi({ autoscroll: !activeUi.autoscroll }) });
      }
      list.push(
        { id: 'toggle-pause', label: activeUi.paused ? 'Resume tailing' : 'Pause tailing', group: 'Log', onRun: () => updateActiveTabUi({ paused: !activeUi.paused }) },
        { id: 'clear', label: 'Clear view', group: 'Log', onRun: clearActiveTab },
        { id: 'find', label: 'Find in view', group: 'Log', shortcut: '⌘F', onRun: () => setFindOpen(true) },
        { id: 'toggle-case', label: activeUi.caseSensitive ? 'Disable case-sensitive filter' : 'Enable case-sensitive filter', group: 'Log', onRun: () => updateActiveTabUi({ caseSensitive: !activeUi.caseSensitive }) },
        { id: 'toggle-wrap', label: activeUi.wrap ? 'Disable line wrap' : 'Enable line wrap', group: 'Log', onRun: () => updateActiveTabUi({ wrap: !activeUi.wrap }) },
        { id: 'font-up', label: 'Increase font size', group: 'Log', onRun: () => stepFontSize(0.5) },
        { id: 'font-down', label: 'Decrease font size', group: 'Log', onRun: () => stepFontSize(-0.5) },
      );
    }

    if (activeTab && presets.length) {
      presets.forEach((p) => {
        list.push({ id: `preset-${p.name}`, label: `Apply preset: ${p.name}`, group: 'Presets', keywords: p.query, onRun: () => updateActiveTabUi({ filterQuery: p.query }) });
      });
    }
    if (groups.length) {
      groups.forEach((g) => {
        list.push({ id: `group-${g.name}`, label: `Open tab group: ${g.name}`, group: 'Tab groups', onRun: () => handleFilesOpen(g.paths) });
      });
    }
    return list;
  }, [
    tabMetaList, activeTabId, activeTab, sidebarOpen, theme, histogramOpen, filterMode, activeUi,
    presets, groups, openPicker, activateTab, closeTab, toggleSidebar, toggleTheme, toggleHistogram,
    toggleFilterMode, handleFetch, clearActiveTab, updateActiveTabUi, stepFontSize, handleFilesOpen,
  ]);

  // Auto-refresh for remote query tabs — re-triggers "Fetch new" on an
  // interval instead of requiring a manual click every time. Off (0) by
  // default; resets whenever the active tab or the chosen interval changes.
  useEffect(() => {
    if (!activeTab || activeTab.kind !== 'api' || !activeUi.autoRefreshSec) return;
    const id = setInterval(async () => {
      setFetching(true);
      try {
        await fetchActiveTab();
      } finally {
        setFetching(false);
      }
    }, activeUi.autoRefreshSec * 1000);
    return () => clearInterval(id);
  }, [activeTab, activeUi.autoRefreshSec, fetchActiveTab]);

  // "/" focuses the filter box (unless already typing somewhere — a plain
  // input/textarea/select, or the CodeMirror raw-request editor); ⌘F/Ctrl+F
  // opens the find bar instead of the browser's native find; Esc closes
  // whichever of find/modal is currently open (find takes priority, since
  // it's the more likely thing you just want to dismiss). Gated on `active`
  // since this tool stays mounted (state-preserving) even while JSON Lens
  // is the one actually on screen — without the gate, these shortcuts would
  // silently fire against a hidden tab instead of whatever you're doing.
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape' && findOpen) {
        e.preventDefault();
        setFindOpen(false);
        return;
      }
      if (e.key === 'Escape' && modal) {
        e.preventDefault();
        setModal(null);
        setRemoteEdit(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && activeTab) {
        e.preventDefault();
        setFindOpen(true);
        return;
      }
      if (e.key === '/' && !modal) {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)
          || activeEl.isContentEditable
          || activeEl.closest?.('.cm-editor')
        );
        if (!isTyping) {
          e.preventDefault();
          filterInputRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modal, findOpen, activeTab, active]);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">log-lens</span>
        <Tooltip label="Fields sidebar" description="Browse this index's cached fields, add columns, and see value distributions.">
          <button type="button" className={sidebarOpen ? 'active icon-btn' : 'icon-btn'} onClick={toggleSidebar}>
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
        <TabBar
          tabs={tabMetaList}
          activeTabId={activeTabId}
          onActivate={activateTab}
          onClose={closeTab}
          onAdd={() => setModal('picker')}
          onReload={handleReloadTab}
          onDuplicate={handleDuplicateTab}
          onDuplicateModify={openDuplicateModify}
          onEdit={openEditRemoteTab}
          onCloseOthers={closeOtherTabs}
          onCloseToRight={closeTabsToRight}
          attentionCounts={attentionCounts}
          getLastLineAt={getLastLineAt}
        />
        <div className="app-header-actions">
          <Tooltip label="Command bar" description="Search and run any action by typing. (⌘K)">
            <button type="button" className="icon-btn" onClick={() => setCommandBarOpen(true)}>
              <Command size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Popover
            align="right"
            trigger={(toggle, open) => (
              <Tooltip label="Tab groups" description="Save the currently open files as a named group, or reopen a saved one." disabled={open}>
                <button type="button" className={open ? 'active icon-btn' : 'icon-btn'} onClick={toggle}>
                  <Layers size={16} strokeWidth={1.75} />
                </button>
              </Tooltip>
            )}
          >
            {(close) => (
              <TabGroupsMenu
                groups={groups}
                openFilePaths={openFilePaths}
                onOpenGroup={(paths) => { handleFilesOpen(paths); close(); }}
                onSaveGroup={saveGroup}
                onRemoveGroup={removeGroup}
                onRenameGroup={renameGroup}
              />
            )}
          </Popover>
          <Tooltip label="Preferences" description="Environments, credentials, appearance, and other app settings.">
            <button type="button" className="icon-btn" onClick={() => setModal('preferences')}>
              <Settings size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip
            label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            description="Toggle the app's color theme."
          >
            <button type="button" className="icon-btn" onClick={toggleTheme}>
              {theme === 'dark' ? <Moon size={16} strokeWidth={1.75} /> : <Sun size={16} strokeWidth={1.75} />}
            </button>
          </Tooltip>
          <Popover
            align="right"
            trigger={(toggle, open) => (
              <Tooltip label="Help" description="JQL syntax reference and keyboard shortcuts." disabled={open}>
                <button type="button" className={open ? 'active icon-btn' : 'icon-btn'} onClick={toggle}>
                  <HelpCircle size={16} strokeWidth={1.75} />
                </button>
              </Tooltip>
            )}
          >
            <HelpPanel />
          </Popover>
        </div>
      </header>

      {activeTab ? (
        <div className="app-body">
          {sidebarOpen && (
            <FieldsSidebar
              buffer={activeBuffer}
              fields={indexFields}
              columns={activeUi.columns}
              onToggleColumn={toggleColumn}
              onApplyFilter={handleApplyFieldFilter}
              width={sidebarWidth}
              onResize={resizeSidebar}
              pinnedSeqs={activeUi.pinnedSeqs}
              onJumpToSeq={(seq) => entryViewRef.current?.scrollToSeq(seq)}
              onUnpin={togglePinned}
            />
          )}
          <div className="app-main">
            <Toolbar
              ui={activeUi}
              onChange={updateActiveTabUi}
              onClear={clearActiveTab}
              isApiTab={activeTab.kind === 'api'}
              onFetch={handleFetch}
              fetching={fetching}
              fontSize={fontSize}
              onStepFontSize={stepFontSize}
              presets={presets}
              currentQuery={activeUi.filterQuery}
              onApplyPreset={(query) => updateActiveTabUi({ filterQuery: query })}
              onSavePreset={savePreset}
              onRemovePreset={removePreset}
              pinnedSeqs={activeUi.pinnedSeqs}
              buffer={activeBuffer}
              onJumpToSeq={(seq) => entryViewRef.current?.scrollToSeq(seq)}
              onUnpin={togglePinned}
              onJumpQuery={handleJumpQuery}
              columns={activeUi.columns}
              onAddColumn={addColumn}
              onRemoveColumn={removeColumn}
              indexFields={indexFields}
              filterInputRef={filterInputRef}
              filterMode={filterMode}
              onToggleFilterMode={toggleFilterMode}
              onOpenFind={() => setFindOpen(true)}
              histogramOpen={histogramOpen}
              onToggleHistogram={toggleHistogram}
              tabLabel={exportLabel}
            />
            {activeTab.kind === 'api' && activeTab.fetchError && (
              <div className="api-error">{activeTab.fetchError}</div>
            )}
            {activeTab.kind === 'api' && stagedFilters.length > 0 && (
              <div className="staged-filters-bar">
                <span className="staged-filters-label">New tab filter</span>
                <div className="preset-list">
                  {stagedFilters.map((f, i) => (
                    <div className="preset-chip" key={`${f.field}:${f.value}:${f.negate}`}>
                      <span className="preset-name">{f.negate ? '-' : ''}{f.field}:{f.value}</span>
                      <button type="button" onClick={() => removeStagedFilter(i)}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={handleCreateStagedTab}>Create new tab</button>
                <button type="button" onClick={clearStagedFilters}>Clear</button>
              </div>
            )}
            {histogramOpen && (
              <TimeHistogram
                buffer={activeBuffer}
                ui={activeUi}
                onChangeUi={updateActiveTabUi}
                intervalMs={histogramIntervalMs}
                onIntervalChange={setHistogramInterval}
              />
            )}
            <EntryView
              ref={entryViewRef}
              buffer={activeBuffer}
              ui={activeUi}
              status={activeTab.status}
              fontSize={fontSize}
              toggleExpanded={toggleExpanded}
              togglePinned={togglePinned}
              onChangeUi={updateActiveTabUi}
              extraColumns={activeUi.columns}
              onToggleColumn={toggleColumn}
              onRemoveColumn={removeColumn}
              tsWidth={tsWidth}
              badgeWidth={badgeWidth}
              extraColumnWidth={extraColumnWidth}
              onResizeColumn={setColumnWidth}
              findOpen={findOpen}
              onCloseFind={() => setFindOpen(false)}
              onSendToJsonLens={onSendToJsonLens}
              onApplyFilter={handleApplyFieldFilter}
              stagedFilters={activeTab.kind === 'api' ? stagedFilters : null}
              onToggleStagedFilter={activeTab.kind === 'api' ? handleToggleStagedFilter : null}
            />
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<ScrollText size={40} strokeWidth={1.25} />}
          title="No tab open"
          subtitle="Tail a local log file or run a remote query against one of your configured environments."
          actions={[
            { label: 'Open a file…', icon: <FileText size={14} strokeWidth={1.75} />, primary: true, onClick: () => openPicker('file') },
            { label: 'Remote query…', icon: <Radio size={14} strokeWidth={1.75} />, onClick: () => openPicker('api') },
          ]}
          listTitle={recentFiles.length ? 'Recent files' : undefined}
          listItems={recentFiles.map((path) => ({
            key: path,
            label: basename(path),
            title: path,
            icon: <Clock size={13} strokeWidth={1.75} />,
            onClick: () => handleFileOpen(path),
          }))}
        />
      )}

      {modal === 'picker' && (
        <TabPickerModal
          onOpenFile={handleFileOpen}
          onOpenFiles={handleFilesOpen}
          onCreateRemote={createRemoteTab}
          onClose={closeModal}
          recentFiles={recentFiles}
          onRemoveRecent={removeRecent}
          initialMode={pickerMode}
        />
      )}
      {modal === 'preferences' && (
        <PreferencesModal onClose={closeModal} theme={theme} onSetTheme={setTheme} />
      )}
      {modal === 'remote-edit' && remoteEdit && (
        <RemoteQueryEditModal
          mode={remoteEdit.mode}
          initialConfig={remoteEdit.initialConfig}
          onCreate={createRemoteTab}
          onSave={updateRemoteTab}
          onClose={closeModal}
        />
      )}
      <CommandBar open={commandBarOpen} onClose={() => setCommandBarOpen(false)} commands={commands} />
    </div>
  );
}
