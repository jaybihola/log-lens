import { useState } from 'react';

export function PresetsMenu({ presets, currentQuery, onApply, onSave, onRemove }) {
  const [name, setName] = useState('');

  const save = () => {
    if (!name.trim()) return;
    onSave(name, currentQuery);
    setName('');
  };

  return (
    <div className="presets-menu">
      {presets.length === 0 ? (
        <div className="picker-empty">No saved presets yet.</div>
      ) : (
        <div className="preset-list">
          {presets.map((p) => (
            <div className="preset-chip" key={p.name}>
              <span className="preset-name" title={p.query} onClick={() => onApply(p.query)}>{p.name}</span>
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
    </div>
  );
}
