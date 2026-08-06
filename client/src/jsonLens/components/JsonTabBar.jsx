import { useState } from 'react';
import { ContextMenu } from '../../shared/components/ContextMenu.jsx';
import { useContextMenu } from '../../shared/hooks/useContextMenu.js';
import { isTabDirty } from '../hooks/useJsonTabs.js';

function downloadTab(tab) {
  const blob = new Blob([tab.content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const base = tab.name.trim().replace(/\.json$/i, '') || 'untitled';
  a.href = url;
  a.download = `${base}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Leaner sibling of the log viewer's TabBar — no server-backed status dot,
// but adds double-click-to-rename since a JSON tab has no file path to fall
// back on for its label, plus a dirty dot for tabs whose content diverges
// from what's actually saved (to a file, a scratch, or nowhere at all yet).
export function JsonTabBar({
  tabs, activeTabId, onActivate, onRequestClose, onAdd, onRename, onDuplicate, onRevert, onCloseOthers, onCloseToRight,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const { menu, openMenu, closeMenu, isMenuActive } = useContextMenu();

  const startRename = (tab) => { setEditingId(tab.id); setDraftName(tab.name); };
  const commitRename = () => {
    if (editingId && draftName.trim()) onRename(editingId, draftName.trim());
    setEditingId(null);
  };

  const handleContextMenu = (e, tab, index) => {
    openMenu(e, [
      { label: 'Rename', onClick: () => startRename(tab) },
      { label: 'Duplicate', onClick: () => onDuplicate(tab.id) },
      { label: 'Revert to saved', onClick: () => onRevert(tab.id), disabled: !isTabDirty(tab), danger: true },
      { divider: true },
      { label: 'Copy content', onClick: () => navigator.clipboard.writeText(tab.content), disabled: !tab.content.trim() },
      { label: 'Download', onClick: () => downloadTab(tab), disabled: !tab.content.trim() },
      { divider: true },
      { label: 'Close', onClick: () => onRequestClose(tab) },
      { label: 'Close others', onClick: () => onCloseOthers(tab.id), disabled: tabs.length <= 1 },
      { label: 'Close tabs to the right', onClick: () => onCloseToRight(tab.id), disabled: index === tabs.length - 1 },
    ], tab.id);
  };

  return (
    <div className={menu ? 'tab-bar menu-open' : 'tab-bar'}>
      <div className="tab-scroll">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={[
              'tab',
              tab.id === activeTabId ? 'active' : '',
              isMenuActive(tab.id) ? 'menu-target' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onActivate(tab.id)}
            onDoubleClick={() => startRename(tab)}
            onContextMenu={(e) => handleContextMenu(e, tab, index)}
            title="Double-click (or right-click) to rename"
          >
            {editingId === tab.id ? (
              <input
                autoFocus
                className="tab-rename-input"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                  if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="tab-label">{tab.name}</span>
                {isTabDirty(tab) && <span className="tab-dirty-dot" />}
              </>
            )}
            <button type="button" className="tab-close" onClick={(e) => { e.stopPropagation(); onRequestClose(tab); }}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="tab-add" onClick={onAdd}>+</button>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  );
}
