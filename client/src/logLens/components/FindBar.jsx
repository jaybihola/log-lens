import { useEffect, useRef } from 'react';
import { Tooltip } from '../../shared/components/Tooltip.jsx';

// Browser-style find-in-view bar: takes the same JQL the filter box does,
// but never removes lines — it only highlights matches (within whatever the
// filter has already narrowed things down to) and lets you step through
// them. Fully controlled — all the matching/navigation state lives in
// EntryView, which is the only place that already has the filtered line
// list and the virtualizer needed to scroll to a match.
//
// `scopeSeq` (set by LogViewerApp when ⌘F/Ctrl+F fires with focus inside an
// expanded entry's own content) narrows the search pool to just that one
// entry instead of the whole view — the label makes the narrower scope
// visible rather than leaving a "why did only one line match?" mystery.
export function FindBar({ query, scopeSeq, onQueryChange, caseSensitive, onToggleCaseSensitive, matchCount, currentIndex, onNext, onPrev, onClose }) {
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className={scopeSeq != null ? 'find-bar find-bar-scoped' : 'find-bar'}>
      {scopeSeq != null && <span className="find-bar-scope-label">Search in Log entry #{scopeSeq}</span>}
      <input
        ref={inputRef}
        type="text"
        className="find-bar-input"
        value={query}
        placeholder={scopeSeq != null ? 'JQL — Enter for next, Shift+Enter for previous' : 'Find in view — JQL (Enter for next, Shift+Enter for previous)'}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) onPrev(); else onNext(); }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
      />
      <span className="find-bar-count">{query.trim() ? `${matchCount ? currentIndex + 1 : 0}/${matchCount}` : ''}</span>
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
