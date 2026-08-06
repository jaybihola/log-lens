import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A right-click menu anchored at cursor coordinates (not a trigger element,
// unlike Popover) — the pattern this app already uses for FieldStatsPopover.
// `items` is [{ label, onClick, danger?, disabled? } | { divider: true }].
// Renders once off-screen to measure itself, then clamps into the viewport
// so a right-click near the window's edge doesn't spill off it.
//
// Portaled straight to <body>: a trigger inside a virtualized/transformed
// ancestor (e.g. a log row, translated by the virtualizer) would otherwise
// break `position: fixed` — a CSS transform on any ancestor makes *that*
// ancestor the containing block for fixed descendants instead of the
// viewport, so the menu's cursor-relative x/y land in the wrong place and
// its z-index only wins within that ancestor's own stacking context (hence
// showing up offset, and behind/blended with sibling rows). Portaling to
// body sidesteps both problems regardless of what triggered it.
export function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxLeft = Math.max(4, window.innerWidth - rect.width - 4);
    const maxTop = Math.max(4, window.innerHeight - rect.height - 4);
    setPos({ left: Math.min(x, maxLeft), top: Math.min(y, maxTop), ready: true });
  }, [x, y]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    const onScroll = () => onClose();
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }}
    >
      {items.map((item, i) => (
        item.divider ? (
          // eslint-disable-next-line react/no-array-index-key
          <div className="context-menu-divider" key={`div-${i}`} />
        ) : (
          <button
            key={item.label}
            type="button"
            className={item.danger ? 'context-menu-item danger' : 'context-menu-item'}
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose(); }}
          >
            {item.label}
          </button>
        )
      ))}
    </div>,
    document.body,
  );
}
