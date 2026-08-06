import { useMemo } from 'react';
import { detectAndHighlight, applyTermHits, highlightJson, tryFormatJson, visibleLength, truncateHtmlToVisibleChars, levelClass, LEVEL_LABELS, LONG_LINE_THRESHOLD } from '../render/highlight.js';
import { formatTimeShort, formatGap } from '../render/timestamp.js';
import { getColumnValue, isColumnValueObject } from '../render/jsonPaths.js';
import { pairColor } from '../render/pairing.js';
import { ExpandedDoc } from './ExpandedDoc.jsx';
import { CopyButton } from '../../shared/components/CopyButton.jsx';
import { Tooltip } from '../../shared/components/Tooltip.jsx';

export function LineRow({
  entry, terms, caseSensitive, findTerms, findCaseSensitive, isCurrentFindMatch,
  pairedSeq, timestamp, gapMs,
  expanded, onToggleExpand, onJumpToPaired,
  pinned, onTogglePinned, flash,
  columns, onToggleColumn,
  tsWidth, badgeWidth, extraColumnWidth,
  onSendToJsonLens, onContextMenu, menuActive,
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

  // The colored level border + hover/active background both live on the
  // wrap (see App.css) so the actions strip below reads as part of the same
  // card as the row, not a separate element glued on underneath it.
  const wrapClass = ['line-wrap', lvlClass, pinned ? 'pinned' : '', menuActive ? 'menu-target' : ''].filter(Boolean).join(' ');
  const rowClass = ['line', lvlClass, flash ? 'flash' : '', isCurrentFindMatch ? 'find-current' : ''].filter(Boolean).join(' ');
  const pretty = tryFormatJson(entry.text);
  const sendToJsonLens = () => onSendToJsonLens(pretty, `Log #${entry.seq}`);

  const handleContextMenu = (e) => {
    onContextMenu(e, entry.seq, [
      { label: 'Copy line', onClick: () => navigator.clipboard.writeText(entry.text) },
      { label: 'Copy as formatted JSON', onClick: () => navigator.clipboard.writeText(pretty), disabled: pretty === entry.text },
      { label: 'Copy line number', onClick: () => navigator.clipboard.writeText(String(entry.seq)) },
      { divider: true },
      { label: pinned ? 'Unpin line' : 'Pin line', onClick: () => onTogglePinned(entry.seq) },
      { label: expanded ? 'Show less' : 'Show more', onClick: () => onToggleExpand(entry.seq) },
      { divider: true },
      { label: 'Send to JSON Lens', onClick: sendToJsonLens, disabled: !onSendToJsonLens },
    ]);
  };

  return (
    <div className={wrapClass}>
      <div className={rowClass} data-seq={entry.seq} onContextMenu={handleContextMenu}>
        <Tooltip label={pinned ? 'Unpin this line' : 'Pin this line'}>
          <span
            className={`pin-col ${pinned ? 'pinned' : ''}`}
            onClick={(e) => { e.stopPropagation(); onTogglePinned(entry.seq); }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true">
              <path d="M6.5 1.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V5l2 3.5V10h-2.5v4.5a.5.5 0 0 1-1 0V10H5V8.5L7 5V1.5Z" />
            </svg>
          </span>
        </Tooltip>
        <span className="num">{entry.seq}</span>
        <span className="pair-col">
          {pairedSeq && (
            <Tooltip label={`Same logger call as #${pairedSeq}`} description="Click to jump to it.">
              <span
                className="pair-ref"
                style={{ color: pairColor(Math.min(entry.seq, pairedSeq)) }}
                onClick={(e) => { e.stopPropagation(); onJumpToPaired(pairedSeq); }}
              >
                ({pairedSeq})
              </span>
            </Tooltip>
          )}
        </span>
        <span className="ts" style={{ width: tsWidth }}>
          {timestamp ? formatTimeShort(timestamp) : ''}
          {gapMs != null && (
            <Tooltip label={`${formatGap(gapMs)} since the previous shown line`} description="An outlier gap for this view.">
              <span className="gap-flag">+{formatGap(gapMs)}</span>
            </Tooltip>
          )}
        </span>
        <span className={`badge ${lvlClass}`} style={{ width: badgeWidth }}>{LEVEL_LABELS[lvlClass] || 'INFO'}</span>
        {columns.map((key) => {
          const value = getColumnValue(entry.text, key);
          const isObj = isColumnValueObject(entry.text, key);
          return (
            <span className="col-extra" key={key} style={{ width: extraColumnWidth(key) }} title={`${key}: ${value || '(empty)'}`}>
              {isObj
                // eslint-disable-next-line react/no-danger
                ? <span dangerouslySetInnerHTML={{ __html: highlightJson(value) }} />
                : value}
            </span>
          );
        })}
        {/* eslint-disable-next-line react/no-danger */}
        <span className="text" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <div className="actions">
        <CopyButton text={entry.text} title="Copy this line's raw text" />
        <Tooltip label="View this line" description="Open in a line-numbered, highlighted viewer.">
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggleExpand(entry.seq); }}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </Tooltip>
        {onSendToJsonLens && (
          <Tooltip label="Open in JSON Lens" description="Send this line to a new JSON Lens tab.">
            <button type="button" onClick={(e) => { e.stopPropagation(); sendToJsonLens(); }}>
              JSON Lens
            </button>
          </Tooltip>
        )}
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
