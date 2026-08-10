import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// A lightweight anchored dropdown — not a full centered modal — for
// low-stakes toggles (view options, quick action lists) that don't warrant
// dimming the whole screen. Closes on outside click, Escape, or scroll (a
// stale-positioned panel left open is worse than a closed one — ContextMenu
// and Dropdown make the same call).
//
// `align` picks which side the panel hangs from by default, but a trigger
// near a viewport edge can still overflow it — after the panel renders, this
// measures itself and clamps back on-screen horizontally, and flips to open
// upward when there isn't room below, the same class of edge case
// ContextMenu/Tooltip/Dropdown already handle.
export function Popover({ trigger, children, align = 'left', panelClassName = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const [overrideStyle, setOverrideStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open) { setOverrideStyle(null); return; }
    const wrap = wrapRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!wrap || !panel) return;
    const style = {};
    const idealLeft = align === 'right' ? wrap.right - panel.width : wrap.left;
    const clampedLeft = Math.min(Math.max(6, idealLeft), window.innerWidth - panel.width - 6);
    style.left = clampedLeft - wrap.left;
    style.right = 'auto';

    // Prefer below; fall back to above only if it actually has more room —
    // and either way, clamp the final position into the viewport rather than
    // blindly flipping, so a trigger near the very top of a short viewport
    // can't push the panel off-screen in the *other* direction instead.
    const spaceBelow = window.innerHeight - wrap.bottom;
    const spaceAbove = wrap.top;
    const openBelow = panel.height + 6 <= spaceBelow || spaceBelow >= spaceAbove;
    let idealTop = openBelow ? wrap.bottom + 6 : wrap.top - panel.height - 6;
    idealTop = Math.min(Math.max(6, idealTop), window.innerHeight - panel.height - 6);
    style.top = idealTop - wrap.top;
    style.bottom = 'auto';

    setOverrideStyle(style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Scrolling something *inside* the panel (e.g. a long preset list)
    // shouldn't close it — only a scroll elsewhere, which would leave the
    // panel's measured position stale.
    const onScroll = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="popover-wrap" ref={wrapRef}>
      {trigger(() => setOpen((v) => !v), open)}
      {open && (
        <div
          ref={panelRef}
          className={`popover-panel align-${align} ${panelClassName}`}
          style={{ ...overrideStyle, visibility: overrideStyle ? 'visible' : 'hidden' }}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}
