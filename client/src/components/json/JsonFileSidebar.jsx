import { useMemo, useState } from 'react';
import { FolderPlus, FilePlus2, FileJson, FileClock } from 'lucide-react';
import { FieldTree } from '../FieldTree.jsx';
import { FilePickerBody } from '../FilePickerBody.jsx';
import { ConfirmModal } from '../ConfirmModal.jsx';
import { PromptModal } from '../PromptModal.jsx';
import { ContextMenu } from '../ContextMenu.jsx';
import { SidebarResizeHandle } from '../SidebarResizeHandle.jsx';
import { Tooltip } from '../Tooltip.jsx';
import { useContextMenu } from '../../hooks/useContextMenu.js';
import { jsonLensApi } from '../../api/jsonLensClient.js';
import { isTabDirty } from '../../hooks/useJsonTabs.js';

const NEW_FILE_TEMPLATE = '{}\n';

// The filesystem-and-scratches sidebar: N open root folders rendered via the
// shared FieldTree component (fed its lazily-loaded `nodes` tree — see
// useJsonFileSystem) and a flat list of app-managed scratch documents below
// it. All disk/scratch mutations (new file, rename, delete, add/remove
// folder) live here since they're inherently tree-shaped operations; opening
// something into an actual editor tab is delegated back up to
// JsonFormatterApp via the onOpen*/on*Renamed/on*Deleted callbacks, since
// tab lifecycle isn't this component's concern.
export function JsonFileSidebar({
  fs, tabs, activeTabId,
  onOpenFile, onOpenScratch, onFileRenamed, onFileDeleted, onScratchRenamed, onScratchDeleted,
  width, onResize,
}) {
  const [modal, setModal] = useState(null);
  const { menu, openMenu, closeMenu, isMenuActive } = useContextMenu();
  const closeModal = () => setModal(null);

  const fileTabByPath = useMemo(() => {
    const m = new Map();
    tabs.forEach((t) => { if (t.origin === 'file') m.set(t.filePath, t); });
    return m;
  }, [tabs]);
  const scratchTabById = useMemo(() => {
    const m = new Map();
    tabs.forEach((t) => { if (t.origin === 'scratch') m.set(t.scratchId, t); });
    return m;
  }, [tabs]);

  const openFile = async (filePath) => {
    const openTab = fileTabByPath.get(filePath);
    if (openTab) { onOpenFile(filePath, openTab.content); return; }
    try {
      const { content } = await jsonLensApi.readFile(filePath);
      onOpenFile(filePath, content);
    } catch (e) {
      setModal({ type: 'error', message: e.message });
    }
  };

  const openScratch = async (scratch) => {
    const openTab = scratchTabById.get(scratch.id);
    if (openTab) { onOpenScratch(scratch.id, scratch.name, openTab.content); return; }
    try {
      const { content } = await jsonLensApi.readScratch(scratch.id);
      onOpenScratch(scratch.id, scratch.name, content);
    } catch (e) {
      setModal({ type: 'error', message: e.message });
    }
  };

  const handleFolderMenu = (e, node) => {
    e.stopPropagation();
    const isRoot = fs.roots.includes(node.path);
    openMenu(e, [
      { label: 'New file…', onClick: () => setModal({ type: 'new-file', folderPath: node.path }) },
      { label: 'Refresh', onClick: () => fs.refreshFolder(node.path) },
      { label: 'Copy path', onClick: () => navigator.clipboard.writeText(node.path) },
      ...(isRoot ? [{ divider: true }, { label: 'Remove folder', onClick: () => fs.removeRoot(node.path), danger: true }] : []),
    ], node.path);
  };

  const handleFileMenu = (e, node) => {
    e.stopPropagation();
    openMenu(e, [
      { label: 'Open', onClick: () => openFile(node.path) },
      { label: 'Rename…', onClick: () => setModal({ type: 'rename-file', filePath: node.path, currentName: node.segment }) },
      { label: 'Copy path', onClick: () => navigator.clipboard.writeText(node.path) },
      { divider: true },
      { label: 'Delete', onClick: () => setModal({ type: 'confirm-delete-file', filePath: node.path, name: node.segment }), danger: true },
    ], node.path);
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

  const renderFolderAction = (node) => (
    <button
      type="button"
      className="field-tree-folder-toggle"
      onClick={(e) => { e.stopPropagation(); setModal({ type: 'new-file', folderPath: node.path }); }}
    >
      <FilePlus2 size={12} strokeWidth={2} />
    </button>
  );

  const renderEmptyFolder = (node, depth) => (
    <p className="json-file-empty" style={{ paddingLeft: 8 + (depth + 1) * 14 }}>Empty folder</p>
  );

  const renderLeaf = (node, depth) => {
    const openTab = fileTabByPath.get(node.path);
    const active = !!openTab && openTab.id === activeTabId;
    const dirty = !!openTab && isTabDirty(openTab);
    return (
      <button
        key={node.path}
        type="button"
        className={[
          'json-file-row',
          active ? 'active' : '',
          isMenuActive(node.path) ? 'menu-target' : '',
        ].filter(Boolean).join(' ')}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => openFile(node.path)}
        onContextMenu={(e) => handleFileMenu(e, node)}
      >
        <FileJson size={13} strokeWidth={1.75} className="json-file-row-icon" />
        <span className="json-file-row-name">{node.segment}</span>
        {dirty && <span className="json-file-row-dirty" />}
      </button>
    );
  };

  return (
    <aside className={menu ? 'fields-sidebar json-file-sidebar menu-open' : 'fields-sidebar json-file-sidebar'} style={{ flexBasis: width }}>
      <div className="fields-sidebar-controls">
        <Tooltip label="Add folder" description="Open a folder from disk and browse its .json files here.">
          <button type="button" className="icon-btn" onClick={() => setModal({ type: 'add-folder' })}>
            <FolderPlus size={14} strokeWidth={1.75} />
          </button>
        </Tooltip>
      </div>

      <div className="fields-sidebar-list">
        <div className="fields-sidebar-section">
          <label>Folders ({fs.roots.length})</label>
          {fs.roots.length === 0 ? (
            <p className="creds-hint fields-sidebar-empty">No folders open — click the folder icon above to add one.</p>
          ) : (
            <FieldTree
              nodes={fs.rootNodes}
              expanded={fs.expanded}
              onToggleExpand={fs.toggleExpand}
              renderLeaf={renderLeaf}
              renderFolderAction={renderFolderAction}
              renderEmptyFolder={renderEmptyFolder}
              onFolderContextMenu={handleFolderMenu}
              isFolderMenuActive={(node) => isMenuActive(node.path)}
            />
          )}
        </div>

        <div className="fields-sidebar-section">
          <label>Scratches ({fs.scratches.length})</label>
          {fs.scratches.length === 0 ? (
            <p className="creds-hint fields-sidebar-empty">Nothing saved as a scratch yet.</p>
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
                      'json-file-row',
                      active ? 'active' : '',
                      isMenuActive(`scratch:${s.id}`) ? 'menu-target' : '',
                    ].filter(Boolean).join(' ')}
                    style={{ paddingLeft: 8 }}
                    onClick={() => openScratch(s)}
                    onContextMenu={(e) => handleScratchMenu(e, s)}
                  >
                    <FileClock size={13} strokeWidth={1.75} className="json-file-row-icon" />
                    <span className="json-file-row-name">{s.name}</span>
                    {dirty && <span className="json-file-row-dirty" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'add-folder' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal picker-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add folder</h3>
            <FilePickerBody
              mode="choose-folder"
              browseFn={jsonLensApi.browse}
              onOpen={(dir) => { fs.addRoot(dir); closeModal(); }}
              onClose={closeModal}
            />
          </div>
        </div>
      )}

      {modal?.type === 'new-file' && (
        <PromptModal
          title="New file"
          message="File name (a .json extension is added automatically)."
          placeholder="untitled.json"
          confirmLabel="Create"
          onCancel={closeModal}
          onConfirm={async (name) => {
            try {
              const filePath = await fs.createFile(modal.folderPath, name, NEW_FILE_TEMPLATE);
              onOpenFile(filePath, NEW_FILE_TEMPLATE);
              closeModal();
            } catch (e) {
              setModal({ type: 'error', message: e.message });
            }
          }}
        />
      )}

      {modal?.type === 'rename-file' && (
        <PromptModal
          title="Rename file"
          initialValue={modal.currentName}
          confirmLabel="Rename"
          onCancel={closeModal}
          onConfirm={async (name) => {
            try {
              const toPath = await fs.renameFile(modal.filePath, name);
              onFileRenamed(modal.filePath, toPath);
              closeModal();
            } catch (e) {
              setModal({ type: 'error', message: e.message });
            }
          }}
        />
      )}

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

      {modal?.type === 'confirm-delete-file' && (
        <ConfirmModal
          title="Delete file"
          message={`Permanently delete "${modal.name}" from disk? This can't be undone.`}
          actions={[{
            label: 'Delete',
            danger: true,
            onClick: async () => {
              await fs.deleteFile(modal.filePath);
              onFileDeleted(modal.filePath);
              closeModal();
            },
          }]}
          onCancel={closeModal}
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
