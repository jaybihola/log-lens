import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, RotateCcw } from 'lucide-react';
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

// Log-volume-over-time strip, stacked by log level — buckets the currently
// filtered/on-screen entries (not the raw unfiltered buffer, and never more
// than what's buffered client-side — see the caption). Mirrors EntryView's
// own pause-freeze behavior (a paused tab keeps showing the snapshot it
// paused on, not lines that kept arriving underneath it) so the strip never
// disagrees with what's actually on screen.
//
// Drag across bars (or click one) to select a time range and apply it as a
// filter on top of the JQL query (see filter/compile.js) — the bars here
// always chart the *JQL-filtered* set regardless of any active time-range
// selection, so the full picture stays visible while you adjust/replace it;
// only EntryView actually narrows to the selected window.
export function TimeHistogram({ buffer, ui, onChangeUi, intervalMs, onIntervalChange }) {
  const { filterQuery, caseSensitive, paused, timeRange } = ui;
  const pausedSnapshotRef = useRef(null);
  if (!paused) pausedSnapshotRef.current = null;
  const effectiveBuffer = paused ? (pausedSnapshotRef.current ??= buffer) : buffer;

  const compiled = useMemo(() => compileQuery(filterQuery, { caseSensitive }), [filterQuery, caseSensitive]);
  const queryActive = filterQuery.trim().length > 0;
  const filtered = useMemo(() => (
    queryActive ? effectiveBuffer.filter((entry) => compiled.matcher(entry.text)) : effectiveBuffer
  ), [effectiveBuffer, compiled, queryActive]);

  const data = useMemo(() => computeTimeHistogram(filtered, { intervalMs }), [filtered, intervalMs]);

  const barsRef = useRef(null);
  // { startIdx, endIdx } while a drag is in progress; null once released
  // (committing the selection to `ui.timeRange` via onChangeUi).
  const [drag, setDrag] = useState(null);

  const indexAtClientX = useCallback((clientX) => {
    const el = barsRef.current;
    if (!el || !data.buckets.length) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.min(data.buckets.length - 1, Math.floor(frac * data.buckets.length));
  }, [data.buckets.length]);

  const handleMouseDown = (e) => {
    if (e.button !== 0 || !data.buckets.length) return;
    e.preventDefault(); // avoid dragging a text selection across the strip
    const idx = indexAtClientX(e.clientX);
    if (idx === null) return;
    setDrag({ startIdx: idx, endIdx: idx });
  };

  useEffect(() => {
    if (!drag) return undefined;
    const handleMove = (e) => {
      const idx = indexAtClientX(e.clientX);
      if (idx === null) return;
      setDrag((prev) => (prev ? { ...prev, endIdx: idx } : prev));
    };
    const handleUp = () => {
      setDrag((prev) => {
        if (prev) {
          const lo = Math.min(prev.startIdx, prev.endIdx);
          const hi = Math.max(prev.startIdx, prev.endIdx);
          onChangeUi?.({ timeRange: { start: data.buckets[lo].start, end: data.buckets[hi].end } });
        }
        return null;
      });
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [drag, data.buckets, onChangeUi, indexAtClientX]);

  const dragSelection = drag ? { lo: Math.min(drag.startIdx, drag.endIdx), hi: Math.max(drag.startIdx, drag.endIdx) } : null;

  const headControls = (
    <div className="time-histogram-head">
      {timeRange && (
        <button type="button" className="time-histogram-reset" onClick={() => onChangeUi?.({ timeRange: null })}>
          <RotateCcw size={11} strokeWidth={2} />
          <span>{formatTimeShort(new Date(timeRange.start).toISOString())} – {formatTimeShort(new Date(timeRange.end).toISOString())}</span>
          <span className="time-histogram-reset-label">Reset zoom</span>
        </button>
      )}
      <span className="time-histogram-head-spacer" />
      <IntervalSelect value={intervalMs} onChange={onIntervalChange} />
    </div>
  );

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
      {headControls}
      <div
        className="time-histogram-bars"
        ref={barsRef}
        onMouseDown={handleMouseDown}
        title="Drag to select a time range and filter to it; click a single bar to zoom to that bucket."
      >
        {data.buckets.map((b, i) => {
          const heightPct = data.maxCount ? Math.max((b.count / data.maxCount) * 100, b.count > 0 ? 6 : 0) : 0;
          const range = `${formatTimeShort(new Date(b.start).toISOString())} – ${formatTimeShort(new Date(b.end).toISOString())}`;
          const dragging = dragSelection && i >= dragSelection.lo && i <= dragSelection.hi;
          const selected = !drag && timeRange && b.end > timeRange.start && b.start < timeRange.end;
          const barClass = ['time-histogram-bar', dragging && 'dragging', selected && 'selected'].filter(Boolean).join(' ');
          return (
            <div key={i} className={barClass} title={`${b.count} line${b.count === 1 ? '' : 's'} · ${range}`}>
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
