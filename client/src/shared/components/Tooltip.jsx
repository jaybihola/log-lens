import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const SHOW_DELAY_MS = 350;

// A richer hover tooltip than the native `title` attribute — a small
// floating card with a bold label plus a one-line description, used on the
// icon-only toolbar buttons (which have no visible text of their own to
// explain what they do). Wraps a single child; positions itself relative to
// that child (below by default, or to the right — see `placement`) and
// clamps into the viewport the same way ContextMenu does.
//
// Dismisses the instant its child is clicked (a lingering tooltip next to
// an action that just fired, or a dropdown that just opened, reads as a
// bug) and — pass `disabled` when wrapping a Popover's trigger, bound to
// that popover's own `open` state — refuses to reopen on hover for as long
// as the thing it opened is still open.
export function Tooltip({ label, description, children, placement = 'bottom', disabled = false }) {
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const timerRef = useRef(null);
  const disabledRef = useRef(disabled);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, ready: false });

  const show = () => {
    if (disabledRef.current) return;
    // Re-check at fire time, not just schedule time — a click can toggle
    // `disabled` true (e.g. the Popover it wraps just opened) in the same
    // tick as a native focus event this span also picks up, racing ahead of
    // this render's prop update. Without the re-check, the stale schedule
    // wins and the tooltip reopens on top of whatever `disabled` was meant
    // to suppress it for.
    timerRef.current = setTimeout(() => { if (!disabledRef.current) setOpen(true); }, SHOW_DELAY_MS);
  };
  const hide = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
  };

  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled) hide();
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = wrapRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!anchor || !panel) return;
    let left;
    let top;
    if (placement === 'right') {
      left = anchor.right + 8;
      top = anchor.top + anchor.height / 2 - panel.height / 2;
    } else {
      left = anchor.left + anchor.width / 2 - panel.width / 2;
      top = anchor.bottom + 8;
    }
    left = Math.min(Math.max(6, left), window.innerWidth - panel.width - 6);
    top = Math.min(Math.max(6, top), window.innerHeight - panel.height - 6);
    setPos({ left, top, ready: true });
  }, [open, placement]);

  return (
    <span
      ref={wrapRef}
      className="tooltip-wrap"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClickCapture={hide}
    >
      {children}
      {open && (
        <div ref={panelRef} className="tooltip-panel" style={{ left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }}>
          <div className="tooltip-label">{label}</div>
          {description && <div className="tooltip-desc">{description}</div>}
        </div>
      )}
    </span>
  );
}
