import { useEffect, useRef, useState } from 'react';
import { ContextMenu } from './ContextMenu.jsx';
import { useContextMenu } from '../hooks/useContextMenu.js';

function basename(p) {
  if (!p) return '(no file)';
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

// Short human label for a remote-query tab: the index, any selected fold
// filter values, and/or the KQL string — whichever of those are set.
function apiTabLabel(tab) {
  const qc = tab.queryConfig || {};
  const parts = [];
  if (qc.index) parts.push(qc.index);
  const foldValues = qc.foldValues || {};
  Object.keys(foldValues).forEach((key) => {
    if (Array.isArray(foldValues[key]) && foldValues[key].length) parts.push(`${key}:${foldValues[key].join(',')}`);
  });
  if (qc.kql && qc.kql.trim()) parts.push(qc.kql.trim());
  if (qc.rawBody) parts.push('(raw)');
  return parts.length ? parts.join(' ') : (tab.environment || 'remote query');
}

function tabLabel(tab) {
  return tab.kind === 'api' ? apiTabLabel(tab) : basename(tab.file);
}

const STATUS_LABEL = {
  watching: 'live', waiting: 'starting…', missing: 'not found', idle: 'idle', error: 'error', fetching: 'fetching…',
};

const SCROLL_STEP = 200;

export function TabBar({ tabs, activeTabId, onActivate, onClose, onAdd, onReload, onCloseOthers, onCloseToRight }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { menu, openMenu, closeMenu, isMenuActive } = useContextMenu();

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

  const handleContextMenu = (e, tab, index) => {
    openMenu(e, [
      { label: tab.kind === 'api' ? 'Fetch new' : 'Reload', onClick: () => onReload(tab) },
      { label: 'Copy tab info', onClick: () => navigator.clipboard.writeText(tab.kind === 'api' ? `${tab.environment}: ${tabLabel(tab)}` : (tab.file || '')) },
      { divider: true },
      { label: 'Close', onClick: () => onClose(tab.id) },
      { label: 'Close others', onClick: () => onCloseOthers(tab.id), disabled: tabs.length <= 1 },
      { label: 'Close tabs to the right', onClick: () => onCloseToRight(tab.id), disabled: index === tabs.length - 1 },
    ], tab.id);
  };

  return (
    <div className={menu ? 'tab-bar menu-open' : 'tab-bar'}>
      {canScrollLeft && (
        <button type="button" className="tab-scroll-btn" onClick={() => scrollBy(-SCROLL_STEP)}>‹</button>
      )}
      <div className="tab-scroll" ref={scrollRef}>
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={[
              'tab',
              tab.id === activeTabId ? 'active' : '',
              isMenuActive(tab.id) ? 'menu-target' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onActivate(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab, index)}
            title={tab.kind === 'api' ? `${tab.environment}: ${tabLabel(tab)}` : (tab.file || '')}
          >
            <span className={`status-dot status-${tab.status}`} title={STATUS_LABEL[tab.status] || tab.status} />
            <span className="tab-label">{tabLabel(tab)}</span>
            <button
              type="button"
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {canScrollRight && (
        <button type="button" className="tab-scroll-btn" onClick={() => scrollBy(SCROLL_STEP)}>›</button>
      )}
      <button type="button" className="tab-add" onClick={onAdd}>+</button>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  );
}
