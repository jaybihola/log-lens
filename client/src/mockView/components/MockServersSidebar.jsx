import { Plus } from 'lucide-react';
import { SidebarResizeHandle } from '../../shared/components/SidebarResizeHandle.jsx';

// Same `.fields-sidebar` shell as MockSidebar (and JSON Lens's
// JsonFileSidebar) — the list of mock-server definitions, each a running/
// stopped dot + name + port.
export function MockServersSidebar({ servers, selectedId, onSelect, onNewServer, width, onResize }) {
  return (
    <aside className="fields-sidebar mock-sidebar" style={{ flexBasis: width }}>
      <div className="fields-sidebar-controls">
        <button type="button" className="sidebar-add-folder-btn" onClick={onNewServer}>
          <Plus size={14} strokeWidth={1.75} />
          <span>New mock server…</span>
        </button>
      </div>

      <div className="fields-sidebar-list">
        <div className="fields-sidebar-section">
          <label>Servers ({servers.length})</label>
          {servers.length === 0 && <p className="creds-hint fields-sidebar-empty">No mock servers yet — click above to create one.</p>}
          {servers.map((s) => (
            <div
              key={s.id}
              className={s.id === selectedId ? 'mock-tree-node mock-server-row selected' : 'mock-tree-node mock-server-row'}
              onClick={() => onSelect(s.id)}
            >
              <span className={s.running ? 'mock-server-dot up' : 'mock-server-dot down'} />
              <span className="mock-tree-path">{s.name}</span>
              <span className="mock-server-port">:{s.port}</span>
            </div>
          ))}
        </div>
      </div>
      <SidebarResizeHandle width={width} onChange={onResize} />
    </aside>
  );
}
