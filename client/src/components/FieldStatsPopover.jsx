import { useMemo, useState } from 'react';
import { computeFieldStats } from '../render/fieldStats.js';

const PREVIEW_COUNT = 5;

// Kibana-style "top values" panel: a small floating card with a horizontal
// bar per value, bar width proportional to that value's share of docs (that
// have the field set) *currently loaded in this tab* — computed from the
// tab's own buffer, not a fresh backend query, so it's instant and stays
// cheap no matter how large the underlying index is (see computeFieldStats).
// Positioned via fixed top/left computed from the hovered row's rect, so it
// isn't clipped by the sidebar's scroll container. Clicking a value applies
// it as a `field:value` JQL token, same as if the user had typed it.
export function FieldStatsPopover({ buffer, field, top, left, onApply, onMouseEnter, onMouseLeave }) {
  const [expanded, setExpanded] = useState(false);
  const data = useMemo(() => computeFieldStats(buffer, field), [buffer, field]);

  const buckets = data.buckets;
  const visible = expanded ? buckets : buckets.slice(0, PREVIEW_COUNT);

  return (
    <div className="field-stats-popover" style={{ top, left }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="field-stats-popover-title">{field}</div>
      {buckets.length === 0 ? (
        <p className="creds-hint">No values in the currently loaded lines.</p>
      ) : (
        <>
          <div className={expanded ? 'field-stats-bars expanded' : 'field-stats-bars'}>
            {visible.map((b) => {
              const pct = data.total ? (b.count / data.total) * 100 : 0;
              return (
                <button
                  type="button"
                  className="field-stats-bar-row"
                  key={b.value}
                  title={`Filter on ${field}:${b.value}`}
                  onClick={() => onApply(field, b.value)}
                >
                  <div className="field-stats-bar-label">
                    <span className="field-stats-bar-value">{b.value}</span>
                    <span className="field-stats-bar-pct">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="field-stats-bar-track">
                    <div className="field-stats-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
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
