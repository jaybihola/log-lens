import { useMemo } from 'react';
import { ChevronDown, Braces, Pin } from 'lucide-react';
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
        <span className="pin-col">
          {pinned && (
            <Tooltip label="Unpin this line">
              <button
                type="button"
                className="pin-indicator"
                onClick={(e) => { e.stopPropagation(); onTogglePinned(entry.seq); }}
              >
                <Pin size={11} strokeWidth={2} fill="currentColor" />
              </button>
            </Tooltip>
          )}
        </span>
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
        <CopyButton
          text={entry.text}
          label="Copy"
          title="Copy line"
          description="Copy this line's raw text."
          className="action-btn"
          icon
        />
        <Tooltip label={pinned ? 'Unpin this line' : 'Pin this line'} description="Keep this line reachable regardless of the current filter.">
          <button
            type="button"
            className={pinned ? 'action-btn active' : 'action-btn'}
            onClick={(e) => { e.stopPropagation(); onTogglePinned(entry.seq); }}
          >
            <Pin size={13} strokeWidth={1.75} fill={pinned ? 'currentColor' : 'none'} />
            {pinned ? 'Unpin' : 'Pin'}
          </button>
        </Tooltip>
        <Tooltip label={expanded ? 'Show less' : 'Show more'} description="Open in a line-numbered, highlighted viewer.">
          <button
            type="button"
            className={expanded ? 'action-btn active' : 'action-btn'}
            onClick={(e) => { e.stopPropagation(); onToggleExpand(entry.seq); }}
          >
            <ChevronDown size={13} strokeWidth={1.75} className={expanded ? 'action-btn-chevron expanded' : 'action-btn-chevron'} />
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </Tooltip>
        {onSendToJsonLens && (
          <Tooltip label="Open in JSON Lens" description="Send this line to a new JSON Lens tab.">
            <button type="button" className="action-btn" onClick={(e) => { e.stopPropagation(); sendToJsonLens(); }}>
              <Braces size={13} strokeWidth={1.75} />
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
