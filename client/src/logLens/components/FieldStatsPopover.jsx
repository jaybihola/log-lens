import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { computeFieldStats } from '../render/fieldStats.js';
import { Tooltip } from '../../shared/components/Tooltip.jsx';

const PREVIEW_COUNT = 5;

// Kibana-style "top values" panel: a small floating card with a horizontal
// bar per value, bar width proportional to that value's share of docs (that
// have the field set) *currently loaded in this tab* — computed from the
// tab's own buffer, not a fresh backend query, so it's instant and stays
// cheap no matter how large the underlying index is (see computeFieldStats).
// `top`/`left` are the hovered row's rect, used as an anchor — clamped into
// the viewport after this renders (same measure-then-place pattern as
// Tooltip/ContextMenu) since a row near the bottom of a tall sidebar would
// otherwise push the card off the bottom of the screen. Clicking a value
// applies it as a `field:value` JQL token, same as if the user had typed it.
export function FieldStatsPopover({ buffer, field, top, left, onApply, onMouseEnter, onMouseLeave }) {
  const [expanded, setExpanded] = useState(false);
  const data = useMemo(() => computeFieldStats(buffer, field), [buffer, field]);
  const ref = useRef(null);
  const [pos, setPos] = useState({ top, left, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clampedLeft = Math.min(Math.max(6, left), window.innerWidth - rect.width - 6);
    const clampedTop = Math.min(Math.max(6, top), window.innerHeight - rect.height - 6);
    setPos({ top: clampedTop, left: clampedLeft, ready: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, left, expanded, data.buckets.length]);

  const buckets = data.buckets;
  const visible = expanded ? buckets : buckets.slice(0, PREVIEW_COUNT);

  return (
    <div
      ref={ref}
      className="field-stats-popover"
      style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="field-stats-popover-title">{field}</div>
      {buckets.length === 0 ? (
        <p className="creds-hint">No values in the currently loaded lines.</p>
      ) : (
        <>
          <div className={expanded ? 'field-stats-bars expanded' : 'field-stats-bars'}>
            {visible.map((b) => (
              <Tooltip key={b.value} label={`Filter on ${field}:${b.value}`} placement="right">
                <button
                  type="button"
                  className="field-stats-bar-row"
                  onClick={() => onApply(field, b.value)}
                >
                  <div className="field-stats-bar-label">
                    <span className="field-stats-bar-value">{b.value}</span>
                    <span className="field-stats-bar-pct">{(data.total ? (b.count / data.total) * 100 : 0).toFixed(1)}%</span>
                  </div>
                  <div className="field-stats-bar-track">
                    <div className="field-stats-bar-fill" style={{ width: `${data.total ? (b.count / data.total) * 100 : 0}%` }} />
                  </div>
                </button>
              </Tooltip>
            ))}
          </div>
          {buckets.length > PREVIEW_COUNT && (
            <button type="button" className="field-stats-expand-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : `Show ${buckets.length - PREVIEW_COUNT} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
