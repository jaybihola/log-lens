import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';

// A ⌘K-style command palette: every command any caller hands it is
// immediately typeable/searchable, rather than requiring a click through
// whatever toolbar/popover it actually lives in. Generic — LogViewerApp.jsx
// and JsonFormatterApp.jsx each build and pass their own flat `commands`
// list (already-disabled entries filtered out by the caller, since "no tab
// open" already means most actions don't apply, same as the real toolbars).
//
// `commands`: [{ id, label, group, keywords?, shortcut?, onRun }]
export function CommandBar({ open, onClose, commands }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    // Let the modal actually mount before focusing.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const haystack = `${c.label} ${c.group || ''} ${c.keywords || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [commands, query]);

  const groups = useMemo(() => {
    const seen = [];
    const byGroup = new Map();
    filtered.forEach((c) => {
      const g = c.group || '';
      if (!byGroup.has(g)) { byGroup.set(g, []); seen.push(g); }
      byGroup.get(g).push(c);
    });
    return seen.map((g) => ({ group: g, items: byGroup.get(g) }));
  }, [filtered]);

  useEffect(() => { setActiveIndex(0); }, [query]);
  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(Math.max(0, filtered.length - 1));
  }, [filtered, activeIndex]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('.command-bar-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const runAt = (index) => {
    const cmd = filtered[index];
    if (!cmd) return;
    onClose();
    cmd.onRun();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); runAt(activeIndex); }
  };

  let flatIndex = -1;

  return (
    <div className="modal-overlay command-bar-overlay" onClick={onClose}>
      <div className="modal command-bar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="command-bar-input-wrap">
          <Search size={15} strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="text"
            className="command-bar-input"
            placeholder="Type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-bar-list" ref={listRef}>
          {groups.length === 0 && <p className="command-bar-empty">No matching commands.</p>}
          {groups.map(({ group, items }) => (
            <div className="command-bar-group" key={group || '_'}>
              {group && <div className="command-bar-group-label">{group}</div>}
              {items.map((cmd) => {
                flatIndex += 1;
                const idx = flatIndex;
                return (
                  <button
                    type="button"
                    key={cmd.id}
                    className={idx === activeIndex ? 'command-bar-item active' : 'command-bar-item'}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => runAt(idx)}
                  >
                    <span className="command-bar-item-label">{cmd.label}</span>
                    {cmd.shortcut && <kbd>{cmd.shortcut}</kbd>}
                    {idx === activeIndex && <CornerDownLeft size={13} strokeWidth={1.75} className="command-bar-item-enter" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
