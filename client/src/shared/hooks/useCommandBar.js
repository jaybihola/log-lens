import { useEffect, useState } from 'react';

// ⌘K / Ctrl+K opens the command bar — gated on `active` since both tools
// stay mounted at all times (see App.jsx) and only the currently-visible
// one should react to the shortcut, same pattern as the ⌘F/⌘S listeners
// already in LogViewerApp.jsx/JsonFormatterApp.jsx.
export function useCommandBar(active) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active]);

  return [open, setOpen];
}
