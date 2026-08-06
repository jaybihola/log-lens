import { useEffect, useRef } from 'react';

// Browser-style find-in-view bar: takes the same JQL the filter box does,
// but never removes lines — it only highlights matches (within whatever the
// filter has already narrowed things down to) and lets you step through
// them. Fully controlled — all the matching/navigation state lives in
// EntryView, which is the only place that already has the filtered line
// list and the virtualizer needed to scroll to a match.
export function FindBar({ query, onQueryChange, caseSensitive, onToggleCaseSensitive, matchCount, currentIndex, onNext, onPrev, onClose }) {
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="find-bar">
      <input
        ref={inputRef}
        type="text"
        className="find-bar-input"
        value={query}
        placeholder="Find in view — JQL (Enter for next, Shift+Enter for previous)"
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) onPrev(); else onNext(); }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
      />
      <span className="find-bar-count">{query.trim() ? `${matchCount ? currentIndex + 1 : 0}/${matchCount}` : ''}</span>
      <button type="button" title="Previous match (Shift+Enter)" onClick={onPrev} disabled={!matchCount}>↑</button>
      <button type="button" title="Next match (Enter)" onClick={onNext} disabled={!matchCount}>↓</button>
      <label className="find-bar-case" title="Case-sensitive">
        <input type="checkbox" checked={caseSensitive} onChange={onToggleCaseSensitive} />
        Aa
      </label>
      <button type="button" title="Close (Esc)" onClick={onClose}>×</button>
    </div>
  );
}
