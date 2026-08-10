import { useMemo, useState } from 'react';
import { FileClock } from 'lucide-react';
import { ConfirmModal } from '../../shared/components/ConfirmModal.jsx';
import { PromptModal } from '../../shared/components/PromptModal.jsx';
import { ContextMenu } from '../../shared/components/ContextMenu.jsx';
import { SidebarResizeHandle } from '../../shared/components/SidebarResizeHandle.jsx';
import { useContextMenu } from '../../shared/hooks/useContextMenu.js';
import { diffLensApi } from '../api/diffLensClient.js';
import { isTabDirty } from '../hooks/useDiffTabs.js';

// A leaner sibling of jsonLens/components/JsonFileSidebar.jsx — scratches
// only, no folder tree (Diff Lens has nothing to browse; a scratch is the
// only way a comparison persists). All scratch mutations (rename, delete)
// live here since they're inherently list operations; opening one into an
// actual tab is delegated back up to DiffLensApp via onOpenScratch, since
// tab lifecycle isn't this component's concern.
export function DiffFileSidebar({
  fs, tabs, activeTabId, onOpenScratch, onScratchRenamed, onScratchDeleted, width, onResize,
}) {
  const [modal, setModal] = useState(null);
  const { menu, openMenu, closeMenu, isMenuActive } = useContextMenu();
  const closeModal = () => setModal(null);

  const scratchTabById = useMemo(() => {
    const m = new Map();
    tabs.forEach((t) => { if (t.origin === 'scratch') m.set(t.scratchId, t); });
    return m;
  }, [tabs]);

  const openScratch = async (scratch) => {
    const openTab = scratchTabById.get(scratch.id);
    if (openTab) {
      onOpenScratch(scratch.id, scratch.name, {
        leftText: openTab.leftText, rightText: openTab.rightText, language: openTab.language, options: openTab.options,
      });
      return;
    }
    try {
      const data = await diffLensApi.readScratch(scratch.id);
      onOpenScratch(scratch.id, scratch.name, data);
    } catch (e) {
      setModal({ type: 'error', message: e.message });
    }
  };

  const handleScratchMenu = (e, scratch) => {
    e.stopPropagation();
    openMenu(e, [
      { label: 'Open', onClick: () => openScratch(scratch) },
      { label: 'Rename…', onClick: () => setModal({ type: 'rename-scratch', id: scratch.id, currentName: scratch.name }) },
      { divider: true },
      { label: 'Delete', onClick: () => setModal({ type: 'confirm-delete-scratch', id: scratch.id, name: scratch.name }), danger: true },
    ], `scratch:${scratch.id}`);
  };

  return (
    <aside className={menu ? 'fields-sidebar diff-file-sidebar menu-open' : 'fields-sidebar diff-file-sidebar'} style={{ flexBasis: width }}>
      <div className="fields-sidebar-list">
        <div className="fields-sidebar-section">
          <label>Scratches ({fs.scratches.length})</label>
          {fs.scratches.length === 0 ? (
            <p className="creds-hint fields-sidebar-empty">Nothing saved as a scratch yet — use "Save as scratch" on a comparison.</p>
          ) : (
            <div className="field-tree">
              {fs.scratches.map((s) => {
                const openTab = scratchTabById.get(s.id);
                const active = !!openTab && openTab.id === activeTabId;
                const dirty = !!openTab && isTabDirty(openTab);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={[
                      'diff-file-row',
                      active ? 'active' : '',
                      isMenuActive(`scratch:${s.id}`) ? 'menu-target' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => openScratch(s)}
                    onContextMenu={(e) => handleScratchMenu(e, s)}
                  >
                    <FileClock size={13} strokeWidth={1.75} className="diff-file-row-icon" />
                    <span className="diff-file-row-name">{s.name}</span>
                    {dirty && <span className="diff-file-row-dirty" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'rename-scratch' && (
        <PromptModal
          title="Rename scratch"
          initialValue={modal.currentName}
          confirmLabel="Rename"
          onCancel={closeModal}
          onConfirm={async (name) => {
            await fs.renameScratch(modal.id, name);
            onScratchRenamed(modal.id, name);
            closeModal();
          }}
        />
      )}

      {modal?.type === 'confirm-delete-scratch' && (
        <ConfirmModal
          title="Delete scratch"
          message={`Permanently delete the scratch "${modal.name}"? This can't be undone.`}
          actions={[{
            label: 'Delete',
            danger: true,
            onClick: async () => {
              await fs.deleteScratchEntry(modal.id);
              onScratchDeleted(modal.id);
              closeModal();
            },
          }]}
          onCancel={closeModal}
        />
      )}

      {modal?.type === 'error' && (
        <ConfirmModal title="Something went wrong" message={modal.message} actions={[]} cancelLabel="OK" onCancel={closeModal} />
      )}

      <SidebarResizeHandle width={width} onChange={onResize} />
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </aside>
  );
}
