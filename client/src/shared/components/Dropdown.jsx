import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

// Custom <select> replacement — this app doesn't use native <select> anywhere
// (see docs/ARCHITECTURE.md), so every "pick one of these" control goes
// through this instead: a button trigger + a portaled listbox panel, same
// portal-to-<body> rationale as ContextMenu.jsx (a trigger living inside a
// scrollable settings pane or a table row would otherwise clip/mis-position
// a `position: fixed` panel). Clamps into the viewport horizontally and
// flips above the trigger when there isn't room below — the same class of
// bug a hand-rolled popover easily gets wrong.
//
// `options`: [{ value, label, disabled? }]. Keyboard: Up/Down moves the
// highlighted option (wrapping, skipping disabled ones), Enter/Space
// commits, Escape closes and refocuses the trigger without changing
// anything, Home/End jump to the first/last enabled option, Tab closes and
// lets focus move on normally. Closes on outside click, on scroll, and on
// window resize (a stale-positioned panel left open is worse than a closed
// one — ContextMenu makes the same call).
export function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className = '',
  panelClassName = '',
  align = 'left',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const optionRefs = useRef([]);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0, ready: false });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const openPanel = (startIndex) => {
    if (disabled || !options.length) return;
    setActiveIndex(startIndex >= 0 ? startIndex : (selectedIndex >= 0 ? selectedIndex : 0));
    setOpen(true);
  };
  const closePanel = (refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const commit = (index) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    closePanel(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!trigger || !panel) return;
    let left = align === 'right' ? trigger.right - panel.width : trigger.left;
    left = Math.min(Math.max(6, left), window.innerWidth - panel.width - 6);
    let top = trigger.bottom + 4;
    const fitsBelow = top + panel.height <= window.innerHeight - 6;
    if (!fitsBelow) {
      const above = trigger.top - panel.height - 4;
      top = above >= 6 ? above : Math.max(6, window.innerHeight - panel.height - 6);
    }
    setPos({ left, top, width: trigger.width, ready: true });
  }, [open, align, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      closePanel();
    };
    const onScroll = () => closePanel();
    const onResize = () => closePanel();
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const moveActive = (delta) => {
    const count = options.length;
    if (!count) return;
    setActiveIndex((prev) => {
      let next = prev;
      for (let i = 0; i < count; i += 1) {
        next = (next + delta + count) % count;
        if (!options[next].disabled) return next;
      }
      return prev;
    });
  };

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPanel(-1);
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(options.findIndex((o) => !o.disabled)); }
    else if (e.key === 'End') {
      e.preventDefault();
      for (let i = options.length - 1; i >= 0; i -= 1) {
        if (!options[i].disabled) { setActiveIndex(i); break; }
      }
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commit(activeIndex); }
    else if (e.key === 'Escape') { e.preventDefault(); closePanel(true); }
    else if (e.key === 'Tab') { closePanel(); }
  };

  return (
    <div className={`dropdown ${className}`} ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="dropdown-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closePanel() : openPanel(-1))}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="dropdown-trigger-label">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={13} strokeWidth={2} className="dropdown-trigger-chevron" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          className={`dropdown-panel ${panelClassName}`}
          style={{ left: pos.left, top: pos.top, minWidth: pos.width, visibility: pos.ready ? 'visible' : 'hidden' }}
        >
          {options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              ref={(el) => { optionRefs.current[i] = el; }}
              role="option"
              aria-selected={opt.value === value}
              disabled={opt.disabled}
              className={[
                'dropdown-option',
                opt.value === value ? 'selected' : '',
                i === activeIndex ? 'active' : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => commit(i)}
            >
              <span className="dropdown-option-check">{opt.value === value && <Check size={12} strokeWidth={2.5} />}</span>
              <span className="dropdown-option-label">{opt.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
