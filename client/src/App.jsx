import { useEffect, useRef, useState } from 'react';
import { useTabs } from './hooks/useTabs.js';
import { useDisplaySettings } from './hooks/useDisplaySettings.js';
import { usePresets } from './hooks/usePresets.js';
import { useRecentFiles } from './hooks/useRecentFiles.js';
import { useColumnWidths } from './hooks/useColumnWidths.js';
import { useTheme } from './hooks/useTheme.js';
import { useIndexFields } from './hooks/useIndexFields.js';
import { useFieldsSidebar } from './hooks/useFieldsSidebar.js';
import { useFilterMode } from './hooks/useFilterMode.js';
import { resolveJumpTarget } from './render/timestamp.js';
import { TabBar } from './components/TabBar.jsx';
import { TabPickerModal } from './components/TabPickerModal.jsx';
import { PreferencesModal } from './components/preferences/PreferencesModal.jsx';
import { HelpPanel } from './components/HelpPanel.jsx';
import { Popover } from './components/Popover.jsx';
import { Toolbar } from './components/Toolbar.jsx';
import { EntryView } from './components/EntryView.jsx';
import { FieldsSidebar } from './components/FieldsSidebar.jsx';
import './App.css';

function App() {
  const {
    tabMetaList, activeTabId, activeBuffer, activeUi,
    openNewTab, activateTab, closeTab, clearActiveTab, updateActiveTabUi,
    toggleExpanded, togglePinned, addColumn, removeColumn, toggleColumn, createRemoteTab, fetchActiveTab,
  } = useTabs();
  const { fontSize, stepFontSize } = useDisplaySettings();
  const { presets, savePreset, removePreset } = usePresets();
  const { recentFiles, addRecent, removeRecent } = useRecentFiles();
  const { tsWidth, badgeWidth, extraColumnWidth, setColumnWidth } = useColumnWidths();
  const { theme, setTheme, toggleTheme } = useTheme();
  const { sidebarOpen, toggleSidebar, sidebarWidth, resizeSidebar } = useFieldsSidebar();
  const { filterMode, toggleFilterMode } = useFilterMode();

  const [modal, setModal] = useState(null); // null | 'picker' | 'preferences'
  const [fetching, setFetching] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const filterInputRef = useRef(null);
  const entryViewRef = useRef(null);

  const activeTab = tabMetaList.find((t) => t.id === activeTabId) || null;
  const indexFields = useIndexFields(activeTab?.environment, activeTab?.queryConfig?.index);
  const closeModal = () => setModal(null);

  const handleFileOpen = async (path) => {
    await openNewTab(path);
    addRecent(path);
    closeModal();
  };

  const handleFetch = async () => {
    setFetching(true);
    try {
      await fetchActiveTab();
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
  const handleApplyFieldFilter = (field, value) => {
    const needsQuotes = /[\s"()]/.test(value) || value === '';
    const token = `${field}:${needsQuotes ? `"${value}"` : value}`;
    const current = activeUi.filterQuery.trim();
    updateActiveTabUi({ filterQuery: current ? `${current} ${token}` : token });
    filterInputRef.current?.focus();
  };

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
  // it's the more likely thing you just want to dismiss).
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && findOpen) {
        e.preventDefault();
        setFindOpen(false);
        return;
      }
      if (e.key === 'Escape' && modal) {
        e.preventDefault();
        setModal(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && activeTab) {
        e.preventDefault();
        setFindOpen(true);
        return;
      }
      if (e.key === '/' && !modal) {
        const active = document.activeElement;
        const isTyping = active && (
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)
          || active.isContentEditable
          || active.closest?.('.cm-editor')
        );
        if (!isTyping) {
          e.preventDefault();
          filterInputRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modal, findOpen, activeTab]);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">log-lens</span>
        <TabBar
          tabs={tabMetaList}
          activeTabId={activeTabId}
          onActivate={activateTab}
          onClose={closeTab}
          onAdd={() => setModal('picker')}
        />
        <div className="app-header-actions">
          <button type="button" className={sidebarOpen ? 'active' : ''} title="Toggle fields sidebar" onClick={toggleSidebar}>▤</button>
          <button type="button" title="Preferences" onClick={() => setModal('preferences')}>⚙</button>
          <button type="button" title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
            {theme === 'dark' ? '☾' : '☀'}
          </button>
          <Popover
            align="right"
            trigger={(toggle, open) => (
              <button type="button" className={open ? 'active' : ''} title="JQL syntax & keyboard shortcuts" onClick={toggle}>?</button>
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
            />
            {activeTab.kind === 'api' && activeTab.fetchError && (
              <div className="api-error">{activeTab.fetchError}</div>
            )}
            <EntryView
              ref={entryViewRef}
              buffer={activeBuffer}
              ui={activeUi}
              status={activeTab.status}
              fontSize={fontSize}
              toggleExpanded={toggleExpanded}
              togglePinned={togglePinned}
              extraColumns={activeUi.columns}
              onToggleColumn={toggleColumn}
              onRemoveColumn={removeColumn}
              tsWidth={tsWidth}
              badgeWidth={badgeWidth}
              extraColumnWidth={extraColumnWidth}
              onResizeColumn={setColumnWidth}
              findOpen={findOpen}
              onCloseFind={() => setFindOpen(false)}
            />
          </div>
        </div>
      ) : (
        <div className="no-tabs">
          <p>No tab open yet.</p>
          <button type="button" onClick={() => setModal('picker')}>Open a tab</button>
        </div>
      )}

      {modal === 'picker' && (
        <TabPickerModal
          onOpenFile={handleFileOpen}
          onCreateRemote={createRemoteTab}
          onClose={closeModal}
          recentFiles={recentFiles}
          onRemoveRecent={removeRecent}
        />
      )}
      {modal === 'preferences' && (
        <PreferencesModal onClose={closeModal} theme={theme} onSetTheme={setTheme} />
      )}
    </div>
  );
}

export default App;
