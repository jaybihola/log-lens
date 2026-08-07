import { useEffect, useRef, useState } from 'react';
import { isTabDirty } from '../hooks/useMockTabs.js';

const SCROLL_STEP = 200;
const METHOD_CLASS = { GET: 'm-get', POST: 'm-post', PUT: 'm-put', PATCH: 'm-patch', DELETE: 'm-delete' };

// Same shape as JsonTabBar.jsx (which itself mirrors Log Lens's TabBar.jsx)
// — the shared `.tab-bar`/`.tab-scroll`/`.tab` classes from App.css, the
// same canScrollLeft/Right + ResizeObserver overflow behavior, the same
// double-click-to-rename (a request tab has no file path to fall back on
// for its label either). The one addition is the method-colored tag before
// the name, since which verb a tab is matters here the way it doesn't for
// a log file or a JSON document.
export function RequestTabBar({ tabs, activeTabId, onActivate, onClose, onAdd, onRename }) {
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    el.addEventListener('scroll', updateScrollState);
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateScrollState);
    };
  }, [tabs.length]);

  const scrollBy = (delta) => scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });

  const startRename = (tab) => { setEditingId(tab.id); setDraftName(tab.name); };
  const commitRename = () => {
    if (editingId && draftName.trim()) onRename(editingId, draftName.trim());
    setEditingId(null);
  };

  return (
    <div className="tab-bar">
      {canScrollLeft && <button type="button" className="tab-scroll-btn" onClick={() => scrollBy(-SCROLL_STEP)}>‹</button>}
      <div className="tab-scroll" ref={scrollRef}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeTabId ? 'tab active' : 'tab'}
            onClick={() => onActivate(tab.id)}
            onDoubleClick={() => startRename(tab)}
            title="Double-click to rename"
          >
            <span className={`mock-method-tag ${METHOD_CLASS[tab.method] || 'm-get'}`}>{tab.method}</span>
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
            <button type="button" className="tab-close" onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}>×</button>
          </div>
        ))}
      </div>
      {canScrollRight && <button type="button" className="tab-scroll-btn" onClick={() => scrollBy(SCROLL_STEP)}>›</button>}
      <button type="button" className="tab-add" onClick={onAdd}>+</button>
    </div>
  );
}
