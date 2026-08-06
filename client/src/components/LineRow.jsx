import { useMemo } from 'react';
import { detectAndHighlight, applyTermHits, visibleLength, truncateHtmlToVisibleChars, levelClass, LEVEL_LABELS, LONG_LINE_THRESHOLD } from '../render/highlight.js';
import { formatTimeShort } from '../render/timestamp.js';
import { getColumnValue } from '../render/jsonPaths.js';
import { pairColor } from '../render/pairing.js';
import { ExpandedDoc } from './ExpandedDoc.jsx';
import { CopyButton } from './CopyButton.jsx';

export function LineRow({
  entry, terms, caseSensitive, findTerms, findCaseSensitive, isCurrentFindMatch,
  pairedSeq, timestamp,
  expanded, onToggleExpand, onJumpToPaired,
  pinned, onTogglePinned, flash,
  columns, onToggleColumn,
  tsWidth, badgeWidth, extraColumnWidth,
}) {
  const lvlClass = levelClass(entry.text);

  const html = useMemo(() => {
    let highlighted = applyTermHits(detectAndHighlight(entry.text, false), terms, caseSensitive);
    if (findTerms && findTerms.length) highlighted = applyTermHits(highlighted, findTerms, findCaseSensitive, 'find-hit');
    if (visibleLength(highlighted) > LONG_LINE_THRESHOLD) {
      return `${truncateHtmlToVisibleChars(highlighted, LONG_LINE_THRESHOLD)} <span class="truncated-hint">…</span>`;
    }
    return highlighted;
  }, [entry.text, terms, caseSensitive, findTerms, findCaseSensitive]);

  const rowClass = ['line', lvlClass, flash ? 'flash' : '', isCurrentFindMatch ? 'find-current' : ''].filter(Boolean).join(' ');

  return (
    <div className="line-wrap">
      <div className={rowClass} data-seq={entry.seq}>
        <span
          className={`pin-col ${pinned ? 'pinned' : ''}`}
          title={pinned ? 'Unpin this line' : 'Pin this line'}
          onClick={(e) => { e.stopPropagation(); onTogglePinned(entry.seq); }}
        >
          <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true">
            <path d="M6.5 1.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V5l2 3.5V10h-2.5v4.5a.5.5 0 0 1-1 0V10H5V8.5L7 5V1.5Z" />
          </svg>
        </span>
        <span className="num">{entry.seq}</span>
        <span className="pair-col">
          {pairedSeq && (
            <span
              className="pair-ref"
              style={{ color: pairColor(Math.min(entry.seq, pairedSeq)) }}
              title={`Same logger call as #${pairedSeq} — click to jump`}
              onClick={(e) => { e.stopPropagation(); onJumpToPaired(pairedSeq); }}
            >
              ({pairedSeq})
            </span>
          )}
        </span>
        <span className="ts" style={{ width: tsWidth }}>{timestamp ? formatTimeShort(timestamp) : ''}</span>
        <span className={`badge ${lvlClass}`} style={{ width: badgeWidth }}>{LEVEL_LABELS[lvlClass] || 'INFO'}</span>
        {columns.map((key) => (
          <span className="col-extra" key={key} style={{ width: extraColumnWidth(key) }} title={`${key}: ${getColumnValue(entry.text, key) || '(empty)'}`}>
            {getColumnValue(entry.text, key)}
          </span>
        ))}
        {/* eslint-disable-next-line react/no-danger */}
        <span className="text" dangerouslySetInnerHTML={{ __html: html }} />
        <span className="actions">
          <CopyButton text={entry.text} title="Copy this line's raw text" />
          <button type="button" title="View this line in a line-numbered, highlighted viewer" onClick={(e) => { e.stopPropagation(); onToggleExpand(entry.seq); }}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </span>
      </div>
      {expanded && (
        <ExpandedDoc
          entry={entry}
          pairedSeq={pairedSeq}
          timeLabel={timestamp ? formatTimeShort(timestamp) : ''}
          levelLabel={LEVEL_LABELS[lvlClass] || 'INFO'}
          columns={columns}
          onToggleColumn={onToggleColumn}
        />
      )}
    </div>
  );
}
