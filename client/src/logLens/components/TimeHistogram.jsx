import { useMemo, useRef } from 'react';
import { BarChart3 } from 'lucide-react';
import { compileQuery } from '../filter/compile.js';
import { computeTimeHistogram, NICE_INTERVALS_MS } from '../render/timeHistogram.js';
import { formatTimeShort, formatGap } from '../render/timestamp.js';

const LEVEL_ORDER = ['lvl-error', 'lvl-warn', 'lvl-info', 'lvl-debug'];

function IntervalSelect({ value, onChange }) {
  return (
    <select
      className="time-histogram-interval"
      value={value == null ? 'auto' : String(value)}
      onChange={(e) => onChange(e.target.value === 'auto' ? null : Number(e.target.value))}
      title="Bucket interval — Auto sizes to the visible time span, like Kibana's own default."
    >
      <option value="auto">Auto interval</option>
      {NICE_INTERVALS_MS.map((ms) => <option key={ms} value={ms}>{formatGap(ms)}</option>)}
    </select>
  );
}

// Log-volume-over-time strip, stacked by log level — bucket the currently
// filtered/on-screen entries (not the raw unfiltered buffer, and never more
// than what's buffered client-side — see the caption) so a burst of activity
// (and what kind) is visible at a glance. Deliberately no drag-to-select /
// click-to-filter yet; just the visual. Mirrors EntryView's own pause-freeze
// behavior (a paused tab keeps showing the snapshot it paused on, not lines
// that kept arriving underneath it) so the strip never disagrees with what's
// actually on screen.
export function TimeHistogram({ buffer, ui, intervalMs, onIntervalChange }) {
  const { filterQuery, caseSensitive, paused } = ui;
  const pausedSnapshotRef = useRef(null);
  if (!paused) pausedSnapshotRef.current = null;
  const effectiveBuffer = paused ? (pausedSnapshotRef.current ??= buffer) : buffer;

  const compiled = useMemo(() => compileQuery(filterQuery, { caseSensitive }), [filterQuery, caseSensitive]);
  const queryActive = filterQuery.trim().length > 0;
  const filtered = useMemo(() => (
    queryActive ? effectiveBuffer.filter((entry) => compiled.matcher(entry.text)) : effectiveBuffer
  ), [effectiveBuffer, compiled, queryActive]);

  const data = useMemo(() => computeTimeHistogram(filtered, { intervalMs }), [filtered, intervalMs]);

  if (data.timestamped === 0) {
    return (
      <div className="time-histogram time-histogram-empty">
        <BarChart3 size={13} strokeWidth={1.75} />
        <span>
          {filtered.length === 0
            ? 'No lines to chart.'
            : `No timestamped lines to chart (${filtered.length} shown, none with a resolvable timestamp).`}
        </span>
        <span className="time-histogram-head-spacer" />
        <IntervalSelect value={intervalMs} onChange={onIntervalChange} />
      </div>
    );
  }

  return (
    <div className="time-histogram">
      <div className="time-histogram-head">
        <span className="time-histogram-head-spacer" />
        <IntervalSelect value={intervalMs} onChange={onIntervalChange} />
      </div>
      <div className="time-histogram-bars" title="Buckets log volume by timestamp for the currently filtered, buffered lines only.">
        {data.buckets.map((b, i) => {
          const heightPct = data.maxCount ? Math.max((b.count / data.maxCount) * 100, b.count > 0 ? 6 : 0) : 0;
          const range = `${formatTimeShort(new Date(b.start).toISOString())} – ${formatTimeShort(new Date(b.end).toISOString())}`;
          return (
            <div
              key={i}
              className="time-histogram-bar"
              title={`${b.count} line${b.count === 1 ? '' : 's'} · ${range}`}
            >
              <div className="time-histogram-bar-fill" style={{ height: `${heightPct}%` }}>
                {LEVEL_ORDER.map((lvl) => (
                  b.byLevel[lvl] > 0 && <div key={lvl} className={`time-histogram-seg ${lvl}`} style={{ flex: `${b.byLevel[lvl]} 0 0` }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="time-histogram-caption">
        <span>{formatTimeShort(new Date(data.min).toISOString())} – {formatTimeShort(new Date(data.max).toISOString())}</span>
        <span className="time-histogram-caption-dim">
          {data.timestamped} of {filtered.length} shown line{filtered.length === 1 ? '' : 's'} charted
          {data.untimestamped ? ` (${data.untimestamped} without a timestamp excluded)` : ''}
          {' '}— showing buffered lines only, not the full file/index.
        </span>
      </div>
    </div>
  );
}
