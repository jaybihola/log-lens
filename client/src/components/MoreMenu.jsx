import { useState } from 'react';
import { ContextMenu } from './ContextMenu.jsx';
import { useContextMenu } from '../hooks/useContextMenu.js';

export function MoreMenu({
  pinnedSeqs, buffer, onJumpToSeq, onUnpin, onJumpQuery,
  columns, onAddColumn, onRemoveColumn,
}) {
  const [jumpValue, setJumpValue] = useState('');
  const [jumpError, setJumpError] = useState(null);
  const [columnPath, setColumnPath] = useState('');
  const { menu, openMenu, closeMenu } = useContextMenu();

  const bySeq = new Map(buffer.map((e) => [e.seq, e]));
  const pinned = [...pinnedSeqs].sort((a, b) => a - b);

  const go = () => {
    const found = onJumpQuery(jumpValue);
    if (!found) { setJumpError('No match in the current buffer/filter'); return; }
    setJumpError(null);
    setJumpValue('');
  };

  const addColumn = () => {
    if (!columnPath.trim()) return;
    onAddColumn(columnPath.trim());
    setColumnPath('');
  };

  const handlePinContextMenu = (e, seq, entry) => {
    openMenu(e, [
      { label: 'Jump to line', onClick: () => onJumpToSeq(seq) },
      { label: 'Copy line', onClick: () => navigator.clipboard.writeText(entry ? entry.text : ''), disabled: !entry },
      { label: 'Copy line number', onClick: () => navigator.clipboard.writeText(String(seq)) },
      { divider: true },
      { label: 'Unpin', onClick: () => onUnpin(seq), danger: true },
    ]);
  };

  const handleColumnContextMenu = (e, key) => {
    openMenu(e, [
      { label: 'Copy field name', onClick: () => navigator.clipboard.writeText(key) },
      { label: 'Remove column', onClick: () => onRemoveColumn(key), danger: true },
    ]);
  };

  return (
    <div className="more-menu">
      <div className="more-menu-section">
        <label>Pinned lines ({pinned.length})</label>
        {pinned.length === 0 ? (
          <div className="picker-empty">Click the pin on any line to pin it.</div>
        ) : (
          <div className="pinned-list">
            {pinned.map((seq) => {
              const entry = bySeq.get(seq);
              return (
                <div className="pinned-item" key={seq} onContextMenu={(e) => handlePinContextMenu(e, seq, entry)}>
                  <span className="pinned-item-seq" onClick={() => onJumpToSeq(seq)}>#{seq}</span>
                  <span className="pinned-item-text" onClick={() => onJumpToSeq(seq)}>
                    {entry ? entry.text.split('\n')[0].slice(0, 120) : '(no longer in buffer)'}
                  </span>
                  <button type="button" onClick={() => onUnpin(seq)}>Unpin</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="view-menu-divider" />
      <div className="more-menu-section">
        <label>Jump to line</label>
        {jumpError && <div className="picker-error">{jumpError}</div>}
        <div className="picker-path-row">
          <input
            type="text"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
            placeholder="240 or 14:32"
          />
          <button type="button" onClick={go}>Go</button>
        </div>
      </div>

      <div className="view-menu-divider" />
      <div className="more-menu-section">
        <label>Columns (this tab)</label>
        {columns.length === 0 ? (
          <div className="picker-empty">No extra columns yet.</div>
        ) : (
          <div className="preset-list">
            {columns.map((key) => (
              <div className="preset-chip" key={key} onContextMenu={(e) => handleColumnContextMenu(e, key)}>
                <span className="preset-name">{key}</span>
                <button type="button" onClick={() => onRemoveColumn(key)}>×</button>
              </div>
            ))}
          </div>
        )}
        <div className="picker-path-row">
          <input
            type="text"
            value={columnPath}
            onChange={(e) => setColumnPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addColumn(); }}
            placeholder="Properties.CorrelationId"
          />
          <button type="button" onClick={addColumn}>+ Column</button>
        </div>
      </div>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  );
}
