import { useEffect, useRef, useState } from 'react';

// A lightweight anchored dropdown — not a full centered modal — for
// low-stakes toggles (view options, quick action lists) that don't warrant
// dimming the whole screen. Closes on outside click or Escape.
export function Popover({ trigger, children, align = 'left', panelClassName = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="popover-wrap" ref={wrapRef}>
      {trigger(() => setOpen((v) => !v), open)}
      {open && (
        <div className={`popover-panel align-${align} ${panelClassName}`}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}
