import { useEffect, useRef } from 'react';

// View mode's non-destructive find-in-view bar — same shape/behavior as Log
// Lens's own FindBar.jsx (query input, n/total count, next/prev, a
// case-sensitivity toggle, close), adapted for JSON content: a plain
// substring search rather than JQL, since there's no need for a query
// language over one document the way there is over a scrolling log stream.
// Never touches what's displayed — only highlights matches (in whichever
// sub-mode is active) and steps through them. Deliberately a separate
// control from the field-filter search box above it, which does remove
// content — see JsonFormatterApp.jsx.
export function JsonFindBar({ query, onQueryChange, caseSensitive, onToggleCaseSensitive, matchCount, currentIndex, onNext, onPrev, onClose }) {
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="json-find-bar">
      <input
        ref={inputRef}
        type="text"
        className="json-find-bar-input"
        value={query}
        placeholder="Find in view (Enter for next, Shift+Enter for previous)"
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) onPrev(); else onNext(); }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
      />
      <span className="json-find-bar-count">{query.trim() ? `${matchCount ? currentIndex + 1 : 0}/${matchCount}` : ''}</span>
      <button type="button" title="Previous match (Shift+Enter)" onClick={onPrev} disabled={!matchCount}>↑</button>
      <button type="button" title="Next match (Enter)" onClick={onNext} disabled={!matchCount}>↓</button>
      <button
        type="button"
        className={caseSensitive ? 'active' : ''}
        title="Case-sensitive"
        onClick={onToggleCaseSensitive}
      >
        Aa
      </button>
      <button type="button" title="Close (Esc)" onClick={onClose}>×</button>
    </div>
  );
}
