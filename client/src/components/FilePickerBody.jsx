import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

function basename(p) {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

export function FilePickerBody({ onOpen, onClose, recentFiles = [], onRemoveRecent }) {
  const [dir, setDir] = useState(null);
  const [parent, setParent] = useState(null);
  const [entries, setEntries] = useState([]);
  const [pathInput, setPathInput] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState(null);

  const browseTo = async (target) => {
    try {
      const data = await api.browse(target, showHidden);
      setDir(data.dir);
      setParent(data.parent);
      setEntries(data.entries);
      setPathInput(data.dir);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { browseTo(null); }, [showHidden]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTyped = () => {
    if (pathInput.trim()) onOpen(pathInput.trim());
  };

  return (
    <>
      {recentFiles.length > 0 && (
        <div className="picker-recent">
          <label>Recent</label>
          <div className="preset-list">
            {recentFiles.map((path) => (
              <div className="preset-chip" key={path} title={path}>
                <span className="preset-name" onClick={() => onOpen(path)}>{basename(path)}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveRecent(path); }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="picker-breadcrumb">
        <button type="button" onClick={() => browseTo('/')}>/</button>
        {dir && dir !== '/' && dir.split('/').filter(Boolean).map((part, i, arr) => {
          const target = `/${arr.slice(0, i + 1).join('/')}`;
          return <button type="button" key={target} onClick={() => browseTo(target)}>{part}</button>;
        })}
      </div>
      {error && <div className="picker-error">{error}</div>}
      <div className="picker-list">
        {parent !== null && (
          <div className="picker-entry" onClick={() => browseTo(parent)}>.. (up)</div>
        )}
        {entries.map((entry) => {
          const full = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
          return (
            <div
              key={entry.name}
              className={`picker-entry ${entry.isDir ? 'dir' : 'file'}`}
              onClick={() => (entry.isDir ? browseTo(full) : setPathInput(full))}
              onDoubleClick={() => { if (!entry.isDir) onOpen(full); }}
            >
              {entry.isDir ? '📁' : '📄'} {entry.name}
            </div>
          );
        })}
      </div>
      <label className="picker-hidden-toggle">
        <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
        Show hidden files
      </label>
      <div className="picker-path-row">
        <input
          type="text"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') openTyped(); }}
          placeholder="/path/to/app.log"
        />
        <button type="button" onClick={openTyped}>Open</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}
