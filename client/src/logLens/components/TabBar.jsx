import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { ContextMenu } from '../../shared/components/ContextMenu.jsx';
import { useContextMenu } from '../../shared/hooks/useContextMenu.js';

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

// Conservative on purpose — a legitimately bursty-then-quiet log shouldn't
// earn a "quiet" label the moment it takes a short breather. Only tabs still
// actively `watching` (not missing/error/idle) ever show this.
const QUIET_THRESHOLD_MS = 3 * 60 * 1000;
const TICK_MS = 30 * 1000;

function formatQuiet(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min - hr * 60}m`;
}

export function TabBar({
  tabs, activeTabId, onActivate, onClose, onAdd, onReload, onCloseOthers, onCloseToRight,
  attentionCounts = {}, getLastLineAt,
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Per-tab "I've seen it, stop showing me" — keyed to the lastLineAt value
  // at dismiss time, so a fresh line arriving (a new lastLineAt) naturally
  // re-arms it rather than needing separate un-dismiss bookkeeping.
  const [dismissedAt, setDismissedAt] = useState({});
  const { menu, openMenu, closeMenu, isMenuActive } = useContextMenu();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

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
        {tabs.map((tab, index) => {
          const attention = tab.id !== activeTabId ? (attentionCounts[tab.id] || 0) : 0;
          const lastLineAt = tab.status === 'watching' && getLastLineAt ? getLastLineAt(tab.id) : null;
          const quietMs = lastLineAt ? now - lastLineAt : 0;
          const isQuiet = lastLineAt && quietMs >= QUIET_THRESHOLD_MS && dismissedAt[tab.id] !== lastLineAt;
          return (
            <div
              key={tab.id}
              className={[
                'tab',
                tab.id === activeTabId ? 'active' : '',
                isMenuActive(tab.id) ? 'menu-target' : '',
                attention ? 'has-attention' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onActivate(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab, index)}
              title={tab.kind === 'api' ? `${tab.environment}: ${tabLabel(tab)}` : (tab.file || '')}
            >
              <span className={`status-dot status-${tab.status}`} title={STATUS_LABEL[tab.status] || tab.status} />
              <span className="tab-label">{tabLabel(tab)}</span>
              {attention > 0 && (
                <span className="tab-attention" title={`${attention} error/warn line${attention === 1 ? '' : 's'} since you last looked`}>
                  <AlertCircle size={11} strokeWidth={2} />
                  {attention > 1 ? attention : ''}
                </span>
              )}
              {isQuiet && (
                <span
                  className="tab-quiet"
                  title={`No new lines in ${formatQuiet(quietMs)} — still watching. Click to dismiss.`}
                  onClick={(e) => { e.stopPropagation(); setDismissedAt((prev) => ({ ...prev, [tab.id]: lastLineAt })); }}
                >
                  <Clock size={10} strokeWidth={1.75} />
                  quiet {formatQuiet(quietMs)}
                </span>
              )}
              <button
                type="button"
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {canScrollRight && (
        <button type="button" className="tab-scroll-btn" onClick={() => scrollBy(SCROLL_STEP)}>›</button>
      )}
      <button type="button" className="tab-add" onClick={onAdd}>+</button>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  );
}
