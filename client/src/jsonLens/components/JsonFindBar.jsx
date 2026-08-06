import { useEffect, useRef } from 'react';
import { Tooltip } from '../../shared/components/Tooltip.jsx';

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
      <Tooltip label="Previous match" description="Shift+Enter"><button type="button" onClick={onPrev} disabled={!matchCount}>↑</button></Tooltip>
      <Tooltip label="Next match" description="Enter"><button type="button" onClick={onNext} disabled={!matchCount}>↓</button></Tooltip>
      <Tooltip label="Case-sensitive">
        <button
          type="button"
          className={caseSensitive ? 'active' : ''}
          onClick={onToggleCaseSensitive}
        >
          Aa
        </button>
      </Tooltip>
      <Tooltip label="Close" description="Esc"><button type="button" onClick={onClose}>×</button></Tooltip>
    </div>
  );
}
