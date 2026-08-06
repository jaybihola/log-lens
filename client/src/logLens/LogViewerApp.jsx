import { useEffect, useRef, useState } from 'react';
import { PanelLeft, Settings, Moon, Sun, HelpCircle, ScrollText, FileText, Radio, Clock } from 'lucide-react';
import { useTabs } from './hooks/useTabs.js';
import { useDisplaySettings } from './hooks/useDisplaySettings.js';
import { usePresets } from './hooks/usePresets.js';
import { useRecentFiles } from './hooks/useRecentFiles.js';
import { useColumnWidths } from './hooks/useColumnWidths.js';
import { useTheme } from '../shell/useTheme.js';
import { useIndexFields } from './hooks/useIndexFields.js';
import { useFieldsSidebar } from './hooks/useFieldsSidebar.js';
import { useFilterMode } from './hooks/useFilterMode.js';
import { resolveJumpTarget } from './render/timestamp.js';
import { TabBar } from './components/TabBar.jsx';
import { TabPickerModal } from './components/TabPickerModal.jsx';
import { PreferencesModal } from './components/preferences/PreferencesModal.jsx';
import { HelpPanel } from './components/HelpPanel.jsx';
import { Popover } from '../shared/components/Popover.jsx';
import { Tooltip } from '../shared/components/Tooltip.jsx';
import { Toolbar } from './components/Toolbar.jsx';
import { EntryView } from './components/EntryView.jsx';
import { FieldsSidebar } from './components/FieldsSidebar.jsx';
import { EmptyState } from '../shared/components/EmptyState.jsx';

function basename(p) {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

export function LogViewerApp({ active, onSendToJsonLens }) {
  const {
    tabMetaList, activeTabId, activeBuffer, activeUi,
    openNewTab, openInTab, activateTab, closeTab, closeOtherTabs, closeTabsToRight, fetchTab, clearActiveTab, updateActiveTabUi,
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
  const [pickerMode, setPickerMode] = useState('file');
  const [fetching, setFetching] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const filterInputRef = useRef(null);
  const entryViewRef = useRef(null);

  const activeTab = tabMetaList.find((t) => t.id === activeTabId) || null;
  const indexFields = useIndexFields(activeTab?.environment, activeTab?.queryConfig?.index);
  const closeModal = () => setModal(null);
  const openPicker = (mode) => { setPickerMode(mode); setModal('picker'); };

  const handleFileOpen = async (path) => {
    await openNewTab(path);
    addRecent(path);
    closeModal();
  };

  // Tab bar context menu's "Reload"/"Fetch new" — a file tab re-tails the
  // same path from scratch, an api tab just re-runs its last query.
  const handleReloadTab = async (tab) => {
    if (tab.kind === 'api') await fetchTab(tab.id);
    else if (tab.file) await openInTab(tab.id, tab.file);
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
        <TabBar
          tabs={tabMetaList}
          activeTabId={activeTabId}
          onActivate={activateTab}
          onClose={closeTab}
          onAdd={() => setModal('picker')}
          onReload={handleReloadTab}
          onCloseOthers={closeOtherTabs}
          onCloseToRight={closeTabsToRight}
        />
        <div className="app-header-actions">
          <Tooltip label="Fields sidebar" description="Browse this index's cached fields, add columns, and see value distributions.">
            <button type="button" className={sidebarOpen ? 'active icon-btn' : 'icon-btn'} onClick={toggleSidebar}>
              <PanelLeft size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
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
              onSendToJsonLens={onSendToJsonLens}
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
    </div>
  );
}
