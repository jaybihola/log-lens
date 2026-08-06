import { useState } from 'react';
import { ContextMenu } from '../../shared/components/ContextMenu.jsx';
import { useContextMenu } from '../../shared/hooks/useContextMenu.js';
import { PromptModal } from '../../shared/components/PromptModal.jsx';

function basename(p) {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

// Popover: saved tab groups (reopen a whole set of file paths in one click)
// + save the currently open file tabs as a new group — same shape as
// PresetsMenu.jsx, adapted for a list of paths instead of one query string.
export function TabGroupsMenu({ groups, openFilePaths, onOpenGroup, onSaveGroup, onRemoveGroup, onRenameGroup }) {
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(null); // group name being renamed, or null
  const { menu, openMenu, closeMenu } = useContextMenu();

  const save = () => {
    if (!name.trim()) return;
    onSaveGroup(name, openFilePaths);
    setName('');
  };

  const handleContextMenu = (e, group) => {
    openMenu(e, [
      { label: 'Open all', onClick: () => onOpenGroup(group.paths) },
      { label: 'Rename', onClick: () => setRenaming(group.name) },
      { label: 'Copy paths', onClick: () => navigator.clipboard.writeText(group.paths.join('\n')) },
      { divider: true },
      { label: 'Remove', onClick: () => onRemoveGroup(group.name), danger: true },
    ]);
  };

  return (
    <div className="presets-menu">
      {groups.length === 0 ? (
        <div className="picker-empty">No saved tab groups yet.</div>
      ) : (
        <div className="preset-list">
          {groups.map((g) => (
            <div
              className="preset-chip"
              key={g.name}
              onContextMenu={(e) => handleContextMenu(e, g)}
              title={g.paths.map(basename).join(', ')}
            >
              <span className="preset-name" onClick={() => onOpenGroup(g.paths)}>
                {g.name} ({g.paths.length})
              </span>
              <button type="button" onClick={() => onRemoveGroup(g.name)}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="picker-path-row">
        <input
          type="text"
          placeholder={openFilePaths.length ? `Save ${openFilePaths.length} open file(s) as…` : 'Open some file tabs first'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          disabled={!openFilePaths.length}
        />
        <button type="button" onClick={save} disabled={!openFilePaths.length}>Save</button>
      </div>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
      {renaming && (
        <PromptModal
          title="Rename tab group"
          initialValue={renaming}
          confirmLabel="Rename"
          onCancel={() => setRenaming(null)}
          onConfirm={(newName) => { onRenameGroup(renaming, newName); setRenaming(null); }}
        />
      )}
    </div>
  );
}
