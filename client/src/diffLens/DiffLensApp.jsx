import { useEffect, useMemo, useRef, useState } from 'react';
import { GitCompare, Plus, PanelLeft, Command } from 'lucide-react';
import { CommandBar } from '../shared/components/CommandBar.jsx';
import { useCommandBar } from '../shared/hooks/useCommandBar.js';
import { EmptyState } from '../shared/components/EmptyState.jsx';
import { ConfirmModal } from '../shared/components/ConfirmModal.jsx';
import { Tooltip } from '../shared/components/Tooltip.jsx';
import { useDiffTabs, isTabDirty } from './hooks/useDiffTabs.js';
import { useDiffScratches } from './hooks/useDiffScratches.js';
import { useDiffSidebar } from './hooks/useDiffSidebar.js';
import { diffLensApi } from './api/diffLensClient.js';
import { DiffTabBar } from './components/DiffTabBar.jsx';
import { DiffToolbar } from './components/DiffToolbar.jsx';
import { DiffFileSidebar } from './components/DiffFileSidebar.jsx';
import { DiffSideBySideView } from './components/DiffSideBySideView.jsx';
import { DiffUnifiedView } from './components/DiffUnifiedView.jsx';
import { buildUnifiedDiff } from './diff/patchFormat.js';
import { detectLanguage } from './diff/languages.js';

const FONT_SIZE_KEY = 'log-lens-diff-editor-font-size';
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

function scratchDataOf(tab) {
  return { leftText: tab.leftText, rightText: tab.rightText, language: tab.language, options: tab.options };
}

// A third independent tool sharing the app shell (see App.jsx) — its own
// tabs (useDiffTabs), toolbar, and one diff view per active tab. Both panes
// in Side-by-side view are directly editable, so there's no separate "input"
// area distinct from the diff itself. Tabs can be plain drafts (autosaved to
// localStorage only, origin 'new') or bound to an app-managed scratch (a
// real file server-side under ~/.log-lens-diff-scratches, shown in the
// sidebar for quick access — see useDiffScratches.js) — same origin/dirty
// model as JSON Lens's tabs, minus the "real file on disk" option, since
// Diff Lens has no folder browsing.
export function DiffLensApp({ active }) {
  const {
    tabs, activeTabId, activeTab, addTab, closeTab, closeOtherTabs, closeTabsToRight,
    duplicateTab, activateTab, renameTab, setLeftText, setRightText, setLanguage,
    setViewMode, setOption, swapSides, clearTab, markSaved, revertTab, openScratchTab,
  } = useDiffTabs();
  const fs = useDiffScratches();
  const { sidebarOpen, toggleSidebar, sidebarWidth, resizeSidebar } = useDiffSidebar();
  const [commandBarOpen, setCommandBarOpen] = useCommandBar(active);
  const [wrap, setWrap] = useState(false);
  const [collapseUnchanged, setCollapseUnchanged] = useState(true);
  const [fontSize, setFontSize] = useState(loadFontSize);
  const [chunks, setChunks] = useState([]);
  const [copyStatus, setCopyStatus] = useState(null);
  const [dialog, setDialog] = useState(null);
  const viewRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_KEY, String(fontSize)); } catch { /* not fatal */ }
  }, [fontSize]);
  const stepFontSize = (delta) => setFontSize((v) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round((v + delta) * 10) / 10)));

  const leftText = activeTab?.leftText || '';
  const rightText = activeTab?.rightText || '';
  const hasContent = !!(leftText.trim() || rightText.trim());
  const viewMode = activeTab?.viewMode || 'side-by-side';
  const options = activeTab?.options || {};
  const dirty = activeTab ? isTabDirty(activeTab) : false;

  const flashCopied = () => { setCopyStatus('Copied'); setTimeout(() => setCopyStatus(null), 1500); };

  const copyLeft = async () => { await navigator.clipboard.writeText(leftText); flashCopied(); };
  const copyRight = async () => { await navigator.clipboard.writeText(rightText); flashCopied(); };

  const patchText = () => buildUnifiedDiff(leftText, rightText, chunks, {
    leftLabel: `${activeTab?.name || 'diff'} (original)`,
    rightLabel: `${activeTab?.name || 'diff'} (modified)`,
  });

  const copyPatch = async () => { await navigator.clipboard.writeText(patchText()); flashCopied(); };

  const downloadPatch = () => {
    const blob = new Blob([patchText()], { type: 'text/x-patch' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = (activeTab?.name || 'diff').trim().replace(/\s+/g, '-').toLowerCase();
    a.href = url;
    a.download = `${base}.patch`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- scratch save/open flows (mirrors JsonFormatterApp.jsx's save-as-
  // scratch / reopen-from-sidebar flow, adapted for a tab with leftText/
  // rightText/language/options instead of a single content string) ----

  const saveTabAsScratch = async (tab, thenClose) => {
    try {
      const entry = await fs.createScratch(tab.name, scratchDataOf(tab));
      markSaved(tab.id, { origin: 'scratch', scratchId: entry.id, name: entry.name });
      setDialog(null);
      if (thenClose) closeTab(tab.id);
    } catch (e) {
      setDialog({ type: 'error', message: e.message });
    }
  };

  const saveTab = async (tab, thenClose = false) => {
    if (tab.origin !== 'scratch') { await saveTabAsScratch(tab, thenClose); return; }
    try {
      await fs.saveScratchData(tab.scratchId, scratchDataOf(tab));
      markSaved(tab.id, {});
      setDialog(null);
      if (thenClose) closeTab(tab.id);
    } catch (e) {
      setDialog({ type: 'error', message: e.message });
    }
  };

  const openScratchFromEmptyState = async (scratch) => {
    try {
      const data = await diffLensApi.readScratch(scratch.id);
      openScratchTab(scratch.id, scratch.name, data);
    } catch (e) {
      setDialog({ type: 'error', message: e.message });
    }
  };

  const requestCloseTab = (tab) => {
    if (!isTabDirty(tab)) { closeTab(tab.id); return; }
    setDialog({ type: tab.origin === 'scratch' ? 'close-bound' : 'close-new', tab });
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

  // A fresh tab's language starts unset ('plaintext') until there's enough
  // pasted content on either side to run the (deliberately narrow) auto-
  // detect heuristics — never overrides a language the user already picked.
  useEffect(() => {
    if (!activeTab || activeTab.language !== 'plaintext') return;
    const detected = detectLanguage(leftText) !== 'plaintext' ? detectLanguage(leftText) : detectLanguage(rightText);
    if (detected !== 'plaintext') setLanguage(activeTab.id, detected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id, leftText, rightText]);

  // Cmd/Ctrl+S saves the active tab — gated on `active` since Diff Lens
  // stays mounted (state-preserving) even while another tool is on screen.
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

  const commands = useMemo(() => {
    const list = [
      { id: 'new-tab', label: 'New comparison', group: 'Tabs', onRun: addTab },
      { id: 'toggle-sidebar', label: sidebarOpen ? 'Hide scratches sidebar' : 'Show scratches sidebar', group: 'View', onRun: toggleSidebar },
    ];
    tabs.filter((t) => t.id !== activeTabId).forEach((t) => {
      list.push({ id: `switch-${t.id}`, label: `Switch to: ${t.name}`, group: 'Tabs', onRun: () => activateTab(t.id) });
    });
    if (activeTab) {
      list.push(
        { id: 'close-tab', label: 'Close current tab', group: 'Tabs', onRun: () => requestCloseTab(activeTab) },
        { id: 'view-side-by-side', label: 'Side-by-side view', group: 'View', onRun: () => setViewMode(activeTab.id, 'side-by-side') },
        { id: 'view-unified', label: 'Unified view', group: 'View', onRun: () => setViewMode(activeTab.id, 'unified') },
        { id: 'toggle-wrap', label: wrap ? 'Disable wrap lines' : 'Enable wrap lines', group: 'View', onRun: () => setWrap((v) => !v) },
        { id: 'swap', label: 'Swap left and right', group: 'Edit', onRun: () => swapSides(activeTab.id) },
        { id: 'clear', label: 'Clear both sides', group: 'Edit', onRun: () => clearTab(activeTab.id) },
        { id: 'zoom-in', label: 'Zoom in', group: 'View', onRun: () => stepFontSize(1) },
        { id: 'zoom-out', label: 'Zoom out', group: 'View', onRun: () => stepFontSize(-1) },
      );
      if (dirty) list.push({ id: 'save', label: 'Save', group: 'Edit', shortcut: '⌘S', onRun: () => saveTab(activeTab) });
      if (hasContent) {
        list.push(
          { id: 'copy-left', label: 'Copy left', group: 'Edit', onRun: copyLeft },
          { id: 'copy-right', label: 'Copy right', group: 'Edit', onRun: copyRight },
        );
      }
      if (chunks.length) {
        list.push(
          { id: 'copy-patch', label: 'Copy as patch', group: 'Edit', onRun: copyPatch },
          { id: 'download-patch', label: 'Download .patch', group: 'Edit', onRun: downloadPatch },
          { id: 'next-change', label: 'Next change', group: 'Edit', onRun: () => viewRef.current?.goToNext() },
          { id: 'prev-change', label: 'Previous change', group: 'Edit', onRun: () => viewRef.current?.goToPrevious() },
        );
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeTabId, activeTab, wrap, hasContent, chunks.length, dirty, sidebarOpen]);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Diff Lens</span>
        <Tooltip label="Scratches sidebar" description="Browse comparisons you've saved for quick access.">
          <button type="button" className={sidebarOpen ? 'active icon-btn' : 'icon-btn'} onClick={toggleSidebar}>
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
        <DiffTabBar
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
        </div>
      </header>

      <div className="app-body">
        {sidebarOpen && (
          <DiffFileSidebar
            fs={fs}
            tabs={tabs}
            activeTabId={activeTabId}
            onOpenScratch={(id, name, data) => openScratchTab(id, name, data)}
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
              icon={<GitCompare size={40} strokeWidth={1.25} />}
              title="No comparison open"
              subtitle="Start a new tab and paste text into either side to compare."
              actions={[{ label: 'New comparison', icon: <Plus size={14} strokeWidth={1.75} />, primary: true, onClick: addTab }]}
              listTitle={fs.scratches.length ? 'Scratches' : undefined}
              listItems={fs.scratches.map((s) => ({
                key: s.id,
                label: s.name,
                icon: <GitCompare size={13} strokeWidth={1.75} />,
                onClick: () => openScratchFromEmptyState(s),
              }))}
            />
          ) : (
            <>
              <DiffToolbar
                language={activeTab.language}
                onSetLanguage={(v) => setLanguage(activeTab.id, v)}
                viewMode={viewMode}
                onSetViewMode={(v) => setViewMode(activeTab.id, v)}
                options={options}
                onSetOption={(key, value) => setOption(activeTab.id, key, value)}
                collapseUnchanged={collapseUnchanged}
                onToggleCollapseUnchanged={() => setCollapseUnchanged((v) => !v)}
                chunks={chunks}
                onGoNext={() => viewRef.current?.goToNext()}
                onGoPrevious={() => viewRef.current?.goToPrevious()}
                onSwap={() => swapSides(activeTab.id)}
                wrap={wrap}
                onToggleWrap={() => setWrap((v) => !v)}
                fontSize={fontSize}
                minFontSize={MIN_FONT_SIZE}
                maxFontSize={MAX_FONT_SIZE}
                onStepFontSize={stepFontSize}
                hasContent={hasContent}
                dirty={dirty}
                onSave={() => saveTab(activeTab)}
                copyStatus={copyStatus}
                onCopyLeft={copyLeft}
                onCopyRight={copyRight}
                onCopyPatch={copyPatch}
                onDownloadPatch={downloadPatch}
                onClear={() => clearTab(activeTab.id)}
              />
              <div className="diff-editor-body">
                {viewMode === 'unified' ? (
                  <DiffUnifiedView
                    ref={viewRef}
                    leftText={leftText}
                    rightText={rightText}
                    language={activeTab.language}
                    options={options}
                    wrap={wrap}
                    fontSize={fontSize}
                    collapseUnchanged={collapseUnchanged}
                    onChunksChange={setChunks}
                  />
                ) : (
                  <DiffSideBySideView
                    ref={viewRef}
                    leftText={leftText}
                    rightText={rightText}
                    onLeftChange={(v) => setLeftText(activeTab.id, v)}
                    onRightChange={(v) => setRightText(activeTab.id, v)}
                    language={activeTab.language}
                    options={options}
                    wrap={wrap}
                    fontSize={fontSize}
                    collapseUnchanged={collapseUnchanged}
                    onChunksChange={setChunks}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {dialog?.type === 'close-new' && (
        <ConfirmModal
          title="Unsaved tab"
          message={`"${dialog.tab.name}" hasn't been saved as a scratch. What would you like to do?`}
          actions={[
            { label: 'Discard', danger: true, onClick: () => { closeTab(dialog.tab.id); setDialog(null); } },
            { label: 'Save as scratch', onClick: () => saveTabAsScratch(dialog.tab, true) },
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

      {dialog?.type === 'error' && (
        <ConfirmModal title="Something went wrong" message={dialog.message} actions={[]} cancelLabel="OK" onCancel={() => setDialog(null)} />
      )}

      <CommandBar open={commandBarOpen} onClose={() => setCommandBarOpen(false)} commands={commands} />
    </div>
  );
}
