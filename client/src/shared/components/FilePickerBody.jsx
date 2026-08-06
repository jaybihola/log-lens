import { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, File, CornerDownLeft, Loader2 } from 'lucide-react';
import { api } from '../../logLens/api/client.js';
import { Tooltip } from './Tooltip.jsx';

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
// `multiple` (opt-in, default false — untouched for every existing caller)
// adds a checkbox to each file row in 'open-file' mode so several files can
// be picked in one round trip; `onOpenMultiple(paths)` fires instead of
// `onOpen` when one or more are checked, useful for e.g. opening a
// docker-compose stack's several log files together. Single-file `onOpen`
// (click a row, double-click, or type+Open) keeps working exactly as before
// even with `multiple` on, so it's never a required prop.
//
// Usability pass: rows are real <button>s (focusable, keyboard-activatable —
// they were bare divs before) with a "filter this folder" input above the
// list driving roving keyboard nav (Up/Down/Home/End/Enter) the same way
// CommandBar and Dropdown already do elsewhere in the app, real lucide
// folder/file icons instead of emoji so they pick up hover/active color like
// every other icon in the app, and explicit loading/empty states instead of
// a list that silently goes blank while browsing or when a folder has
// nothing in it.
export function FilePickerBody({
  onOpen, onOpenMultiple, onClose, recentFiles = [], onRemoveRecent,
  mode = 'open-file', browseFn = api.browse, initialFileName = '', multiple = false,
}) {
  const [dir, setDir] = useState(null);
  const [parent, setParent] = useState(null);
  const [entries, setEntries] = useState([]);
  const [pathInput, setPathInput] = useState('');
  const [fileName, setFileName] = useState(initialFileName);
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const filterInputRef = useRef(null);
  const rowRefs = useRef([]);

  const browseTo = async (target) => {
    setLoading(true);
    try {
      const data = await browseFn(target, showHidden);
      setDir(data.dir);
      setParent(data.parent);
      setEntries(data.entries);
      setPathInput(data.dir);
      setError(null);
      setFilter('');
      setActiveIndex(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { browseTo(null); }, [showHidden]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEntries = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, filter]);

  // The keyboard-navigable list: an optional synthetic "go up" row first,
  // then whatever's left after the filter — one flat array so Up/Down/Enter
  // in the filter input can address it by a single index.
  const rows = useMemo(() => {
    const r = [];
    if (parent !== null) r.push({ up: true });
    filteredEntries.forEach((entry) => r.push({ entry }));
    return r;
  }, [parent, filteredEntries]);

  useEffect(() => {
    if (activeIndex >= rows.length) setActiveIndex(Math.max(0, rows.length - 1));
  }, [rows, activeIndex]);

  useEffect(() => {
    rowRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const openTyped = () => {
    if (pathInput.trim()) onOpen(pathInput.trim());
  };
  const chooseFolder = () => {
    if (dir) onOpen(dir);
  };
  const saveAs = () => {
    if (dir && fileName.trim()) onOpen(joinPath(dir, fileName.trim()));
  };
  const toggleSelected = (path) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const openSelected = () => {
    if (!selected.size) return;
    const paths = [...selected];
    if (onOpenMultiple) onOpenMultiple(paths);
    else paths.forEach((p) => onOpen(p));
  };

  // Single-click/Enter on a row: navigate into a directory, or — matching
  // the pre-existing click behavior exactly — stage a file into whichever
  // text field the current mode's action row actually uses.
  const selectEntry = (entry) => {
    const full = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
    if (entry.isDir) { browseTo(full); return; }
    if (mode === 'save-file') setFileName(entry.name);
    else setPathInput(full);
  };

  // Enter on a file row in 'open-file' mode opens it immediately (same as a
  // double-click) rather than just staging the path — type-to-filter,
  // arrow to it, Enter to open is the point of adding the filter input at
  // all; every other mode keeps Enter meaning "stage this", same as a click.
  const activateRow = (row) => {
    if (!row) return;
    if (row.up) { browseTo(parent); return; }
    const { entry } = row;
    const full = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
    if (!entry.isDir && mode === 'open-file') { onOpen(full); return; }
    selectEntry(entry);
  };

  const onFilterKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (rows.length ? (i + 1) % rows.length : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === 'End') { e.preventDefault(); setActiveIndex(Math.max(0, rows.length - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); activateRow(rows[activeIndex]); }
    else if (e.key === 'Escape' && filter) { e.preventDefault(); setFilter(''); }
  };

  return (
    <>
      {mode === 'open-file' && recentFiles.length > 0 && (
        <div className="picker-recent">
          <label>Recent</label>
          <div className="preset-list">
            {recentFiles.map((path) => (
              <Tooltip key={path} label={basename(path)} description={path}>
                <div className="preset-chip">
                  <span className="preset-name" onClick={() => onOpen(path)}>{basename(path)}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveRecent(path); }}>×</button>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
      <div className="picker-breadcrumb-row">
        <div className="picker-breadcrumb">
          <button type="button" onClick={() => browseTo('/')}>/</button>
          {dir && dir !== '/' && dir.split('/').filter(Boolean).map((part, i, arr) => {
            const target = `/${arr.slice(0, i + 1).join('/')}`;
            return <button type="button" key={target} onClick={() => browseTo(target)}>{part}</button>;
          })}
        </div>
        <Tooltip label={showHidden ? 'Hide hidden files' : 'Show hidden files'}>
          <button
            type="button"
            className={showHidden ? 'active icon-btn' : 'icon-btn'}
            onClick={() => setShowHidden((v) => !v)}
          >
            .*
          </button>
        </Tooltip>
      </div>
      {error && <div className="picker-error">{error}</div>}
      <input
        ref={filterInputRef}
        type="text"
        className="picker-filter-input"
        placeholder="Filter this folder…"
        value={filter}
        onChange={(e) => { setFilter(e.target.value); setActiveIndex(0); }}
        onKeyDown={onFilterKeyDown}
      />
      <div className="picker-list">
        {loading && <div className="picker-list-status"><Loader2 size={14} strokeWidth={2} className="spin" />Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="picker-list-status">{filter ? `No files match "${filter}"` : 'This folder is empty'}</div>
        )}
        {!loading && rows.map((row, i) => {
          if (row.up) {
            return (
              <button
                type="button"
                key="__up"
                ref={(el) => { rowRefs.current[i] = el; }}
                className={i === activeIndex ? 'picker-entry picker-entry-up active' : 'picker-entry picker-entry-up'}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => browseTo(parent)}
              >
                <Folder size={14} strokeWidth={1.75} className="picker-entry-icon" />
                <span>.. (up)</span>
              </button>
            );
          }
          const { entry } = row;
          const full = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
          const showCheckbox = multiple && mode === 'open-file' && !entry.isDir;
          return (
            <button
              type="button"
              key={entry.name}
              ref={(el) => { rowRefs.current[i] = el; }}
              className={[
                'picker-entry',
                entry.isDir ? 'dir' : 'file',
                i === activeIndex ? 'active' : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => selectEntry(entry)}
              onDoubleClick={() => { if (!entry.isDir && mode === 'open-file') onOpen(full); }}
            >
              {showCheckbox && (
                <input
                  type="checkbox"
                  className="picker-entry-checkbox"
                  checked={selected.has(full)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelected(full)}
                />
              )}
              {entry.isDir
                ? <Folder size={14} strokeWidth={1.75} className="picker-entry-icon" />
                : <File size={14} strokeWidth={1.75} className="picker-entry-icon" />}
              <span className="picker-entry-name">{entry.name}</span>
              {i === activeIndex && !entry.isDir && mode === 'open-file' && (
                <CornerDownLeft size={12} strokeWidth={1.75} className="picker-entry-enter" />
              )}
            </button>
          );
        })}
      </div>

      {mode === 'open-file' && multiple && selected.size > 0 && (
        <div className="picker-path-row">
          <span className="picker-selected-count">{selected.size} file{selected.size === 1 ? '' : 's'} selected</span>
          <button type="button" onClick={openSelected}>Open {selected.size} selected</button>
          <button type="button" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
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
