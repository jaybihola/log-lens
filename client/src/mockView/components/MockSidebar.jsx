import { useState } from 'react';
import { Plus, FolderPlus, Trash2, ChevronRight, ChevronDown, Pencil } from 'lucide-react';
import { Dropdown } from '../../shared/components/Dropdown.jsx';
import { Tooltip } from '../../shared/components/Tooltip.jsx';
import { SidebarResizeHandle } from '../../shared/components/SidebarResizeHandle.jsx';

const METHOD_CLASS = { GET: 'm-get', POST: 'm-post', PUT: 'm-put', PATCH: 'm-patch', DELETE: 'm-delete' };

function MethodTag({ method }) {
  return <span className={`mock-method-tag ${METHOD_CLASS[method] || 'm-get'}`}>{method}</span>;
}

function RequestRow({ request, collectionId, onOpen, onDelete, depth }) {
  return (
    <div className="mock-tree-node" style={{ paddingLeft: 8 + depth * 16 }} onClick={() => onOpen(collectionId, request)}>
      <MethodTag method={request.method} />
      <span className="mock-tree-path">{request.name}</span>
      <button type="button" className="icon-btn mock-tree-action" onClick={(e) => { e.stopPropagation(); onDelete(collectionId, request.id); }}>
        <Trash2 size={12} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function FolderRow({ folder, collectionId, expanded, onToggle, onOpen, onDeleteFolder, onDeleteRequest, onNewRequest }) {
  return (
    <>
      <div className="mock-tree-node mock-tree-folder" style={{ paddingLeft: 8 }} onClick={() => onToggle(folder.id)}>
        {expanded ? <ChevronDown size={12} className="mock-tree-chev" /> : <ChevronRight size={12} className="mock-tree-chev" />}
        <span className="mock-tree-path">{folder.name}</span>
        <button type="button" className="icon-btn mock-tree-action" onClick={(e) => { e.stopPropagation(); onNewRequest(collectionId, folder.id); }}>
          <Plus size={12} strokeWidth={1.75} />
        </button>
        <button type="button" className="icon-btn mock-tree-action" onClick={(e) => { e.stopPropagation(); onDeleteFolder(collectionId, folder.id); }}>
          <Trash2 size={12} strokeWidth={1.75} />
        </button>
      </div>
      {expanded && folder.requests.map((r) => (
        <RequestRow key={r.id} request={r} collectionId={collectionId} onOpen={onOpen} onDelete={onDeleteRequest} depth={2} />
      ))}
    </>
  );
}

// Collections tree (one level of folders, each holding requests, plus
// ungrouped requests directly on the collection) + the environment picker —
// the request-builder screen's left rail. Same `.fields-sidebar` shell
// (controls row / scrollable sectioned list / resize handle) as JSON Lens's
// JsonFileSidebar — lazy loading isn't needed here though, a saved-requests
// tree is small enough to just render whole, unlike a real filesystem.
export function MockSidebar({
  collections, environments, activeEnvironmentId, activeEnvironment, onSetActiveEnvironment,
  onOpenRequest, onNewCollection, onNewFolder, onNewRequest, onDeleteCollection, onDeleteFolder, onDeleteRequest,
  onNewEnvironment, onEditEnvironment, width, onResize,
}) {
  const [expandedCollections, setExpandedCollections] = useState(() => new Set(collections.map((c) => c.id)));
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());

  const toggleCollection = (id) => setExpandedCollections((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleFolder = (id) => setExpandedFolders((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const envOptions = environments.map((e) => ({ value: e.id, label: e.name }));

  return (
    <aside className="fields-sidebar mock-sidebar" style={{ flexBasis: width }}>
      <div className="fields-sidebar-controls">
        <button type="button" className="sidebar-add-folder-btn" onClick={onNewCollection}>
          <Plus size={14} strokeWidth={1.75} />
          <span>New collection…</span>
        </button>
      </div>

      <div className="fields-sidebar-list">
        <div className="fields-sidebar-section">
          <label>Collections ({collections.length})</label>
          {collections.length === 0 && <p className="creds-hint fields-sidebar-empty">No collections yet — click above to create one.</p>}
          {collections.map((c) => {
          const expanded = expandedCollections.has(c.id);
          return (
            <div key={c.id}>
              <div className="mock-tree-node mock-tree-collection" onClick={() => toggleCollection(c.id)}>
                {expanded ? <ChevronDown size={12} className="mock-tree-chev" /> : <ChevronRight size={12} className="mock-tree-chev" />}
                <span className="mock-tree-path">{c.name}</span>
                <button type="button" className="icon-btn mock-tree-action" onClick={(e) => { e.stopPropagation(); onNewFolder(c.id); }}>
                  <FolderPlus size={12} strokeWidth={1.75} />
                </button>
                <button type="button" className="icon-btn mock-tree-action" onClick={(e) => { e.stopPropagation(); onNewRequest(c.id, null); }}>
                  <Plus size={12} strokeWidth={1.75} />
                </button>
                <button type="button" className="icon-btn mock-tree-action" onClick={(e) => { e.stopPropagation(); onDeleteCollection(c.id); }}>
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </div>
              {expanded && (
                <>
                  {c.folders.map((f) => (
                    <FolderRow
                      key={f.id}
                      folder={f}
                      collectionId={c.id}
                      expanded={expandedFolders.has(f.id)}
                      onToggle={toggleFolder}
                      onOpen={onOpenRequest}
                      onDeleteFolder={onDeleteFolder}
                      onDeleteRequest={onDeleteRequest}
                      onNewRequest={onNewRequest}
                    />
                  ))}
                  {c.requests.map((r) => (
                    <RequestRow key={r.id} request={r} collectionId={c.id} onOpen={onOpenRequest} onDelete={onDeleteRequest} depth={1} />
                  ))}
                </>
              )}
            </div>
          );
          })}
        </div>

        <div className="fields-sidebar-section">
          <div className="mock-env-card-head">
            <label style={{ padding: 0, border: 'none', margin: 0 }}>Environment</label>
            <div className="mock-env-card-actions">
              {activeEnvironment && (
                <Tooltip label="Edit variables">
                  <button type="button" className="icon-btn" onClick={() => onEditEnvironment(activeEnvironment)}><Pencil size={12} strokeWidth={1.75} /></button>
                </Tooltip>
              )}
              <Tooltip label="New environment">
                <button type="button" className="icon-btn" onClick={onNewEnvironment}><Plus size={12} strokeWidth={1.75} /></button>
              </Tooltip>
            </div>
          </div>
          <Dropdown
            value={activeEnvironmentId}
            options={envOptions}
            onChange={onSetActiveEnvironment}
            placeholder="No environment"
            className="mock-env-dropdown"
          />
          {activeEnvironment && activeEnvironment.variables.length > 0 && (
            <div className="mock-env-vars">
              {activeEnvironment.variables.slice(0, 4).map((v) => (
                <div key={v.id || v.key} className="mock-env-var-row">
                  <span className="k">{v.key}</span>
                  <span className="v">{v.key.toLowerCase().includes('token') || v.key.toLowerCase().includes('secret') ? '•'.repeat(Math.min(10, (v.value || '').length || 8)) : v.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <SidebarResizeHandle width={width} onChange={onResize} />
    </aside>
  );
}
