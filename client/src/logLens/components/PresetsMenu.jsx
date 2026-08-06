import { useState } from 'react';
import { ContextMenu } from '../../shared/components/ContextMenu.jsx';
import { useContextMenu } from '../../shared/hooks/useContextMenu.js';
import { Tooltip } from '../../shared/components/Tooltip.jsx';

export function PresetsMenu({ presets, currentQuery, onApply, onSave, onRemove }) {
  const [name, setName] = useState('');
  const { menu, openMenu, closeMenu } = useContextMenu();

  const save = () => {
    if (!name.trim()) return;
    onSave(name, currentQuery);
    setName('');
  };

  const handleContextMenu = (e, preset) => {
    openMenu(e, [
      { label: 'Apply', onClick: () => onApply(preset.query) },
      { label: 'Copy query', onClick: () => navigator.clipboard.writeText(preset.query) },
      { divider: true },
      { label: 'Remove', onClick: () => onRemove(preset.name), danger: true },
    ]);
  };

  return (
    <div className="presets-menu">
      {presets.length === 0 ? (
        <div className="picker-empty">No saved presets yet.</div>
      ) : (
        <div className="preset-list">
          {presets.map((p) => (
            <div className="preset-chip" key={p.name} onContextMenu={(e) => handleContextMenu(e, p)}>
              <Tooltip label={p.name} description={p.query}>
                <span className="preset-name" onClick={() => onApply(p.query)}>{p.name}</span>
              </Tooltip>
              <button type="button" onClick={() => onRemove(p.name)}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="picker-path-row">
        <input
          type="text"
          placeholder="Save current filter as…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        />
        <button type="button" onClick={save}>Save</button>
      </div>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  );
}
