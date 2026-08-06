import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

function basename(p) {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

function joinPath(dir, name) {
  if (!dir) return name;
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`;
}

// Directory-browsing UI shared across every "pick something on disk" flow in
// the app. `mode` decides what the bottom action row looks like and what
// `onOpen(path)` ultimately gets called with:
//  - 'open-file' (default, Log Lens's original behavior, untouched): type or
//    double-click a file path, Open.
//  - 'choose-folder': confirms the currently browsed directory itself —
//    JSON Lens's "Add folder".
//  - 'save-file': browse to a destination directory, type a filename,
//    Save — JSON Lens's "Save As".
// `browseFn` defaults to Log Lens's own /api/browse; JSON Lens passes its
// own json-filtered browse endpoint instead.
export function FilePickerBody({
  onOpen, onClose, recentFiles = [], onRemoveRecent,
  mode = 'open-file', browseFn = api.browse, initialFileName = '',
}) {
  const [dir, setDir] = useState(null);
  const [parent, setParent] = useState(null);
  const [entries, setEntries] = useState([]);
  const [pathInput, setPathInput] = useState('');
  const [fileName, setFileName] = useState(initialFileName);
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState(null);

  const browseTo = async (target) => {
    try {
      const data = await browseFn(target, showHidden);
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
  const chooseFolder = () => {
    if (dir) onOpen(dir);
  };
  const saveAs = () => {
    if (dir && fileName.trim()) onOpen(joinPath(dir, fileName.trim()));
  };

  return (
    <>
      {mode === 'open-file' && recentFiles.length > 0 && (
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
          const selectEntry = () => {
            if (entry.isDir) { browseTo(full); return; }
            if (mode === 'save-file') setFileName(entry.name);
            else setPathInput(full);
          };
          return (
            <div
              key={entry.name}
              className={`picker-entry ${entry.isDir ? 'dir' : 'file'}`}
              onClick={selectEntry}
              onDoubleClick={() => { if (!entry.isDir && mode === 'open-file') onOpen(full); }}
            >
              {entry.isDir ? '📁' : '📄'} {entry.name}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className={showHidden ? 'picker-hidden-toggle active' : 'picker-hidden-toggle'}
        onClick={() => setShowHidden((v) => !v)}
      >
        Show hidden files
      </button>

      {mode === 'open-file' && (
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
      )}
      {mode === 'choose-folder' && (
        <div className="picker-path-row">
          <input type="text" value={dir || ''} readOnly />
          <button type="button" onClick={chooseFolder} disabled={!dir}>Choose this folder</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      )}
      {mode === 'save-file' && (
        <div className="picker-path-row">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveAs(); }}
            placeholder="filename.json"
          />
          <button type="button" onClick={saveAs} disabled={!fileName.trim()}>Save</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      )}
    </>
  );
}
