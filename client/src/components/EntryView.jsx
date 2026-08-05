import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { compileQuery } from '../filter/compile.js';
import { ownTimestamp } from '../render/timestamp.js';
import { LineRow } from './LineRow.jsx';
import { LogHeader } from './LogHeader.jsx';

export const EntryView = forwardRef(function EntryView({
  buffer, ui, status, highlightOnly, fontSize,
  toggleExpanded, togglePinned,
  extraColumns, onToggleColumn, onRemoveColumn,
  tsWidth, badgeWidth, extraColumnWidth, onResizeColumn,
}, ref) {
  const { filterQuery, caseSensitive, autoscroll, paused, wrap, expandedSeqs, pinnedSeqs } = ui;
  const scrollRef = useRef(null);
  const pausedSnapshotRef = useRef(null);
  const [flashSeq, setFlashSeq] = useState(null);

  if (!paused) pausedSnapshotRef.current = null;
  const effectiveBuffer = paused
    ? (pausedSnapshotRef.current ??= buffer)
    : buffer;

  const compiled = useMemo(() => compileQuery(filterQuery, { caseSensitive }), [filterQuery, caseSensitive]);
  const queryActive = filterQuery.trim().length > 0;

  const visible = useMemo(() => {
    if (!queryActive) return effectiveBuffer.map((entry) => ({ entry, isMatch: true }));
    return effectiveBuffer
      .map((entry) => ({ entry, isMatch: compiled.matcher(entry.text) }))
      .filter((row) => highlightOnly || row.isMatch);
  }, [effectiveBuffer, compiled, queryActive, highlightOnly]);

  const matchCount = queryActive ? visible.filter((row) => row.isMatch).length : visible.length;

  // Windowed rendering — only visible rows (plus overscan) exist as real DOM
  // nodes, so the buffer's ring-buffer cap (thousands of lines) doesn't
  // translate into thousands of live nodes. Row height varies (wrapped long
  // lines, an expanded field table/code viewer underneath), so each row
  // reports its real measured height back via measureElement rather than
  // relying on a single estimate.
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 10,
    getItemKey: (index) => visible[index].entry.seq,
  });

  // Jump to a specific seq (pinned-line navigation, jump-to-line/timestamp)
  // — only works if that entry is in the currently filtered/visible set.
  // Briefly flashes the target row so a jump to an already-on-screen line is
  // still noticeable.
  useImperativeHandle(ref, () => ({
    scrollToSeq(seq) {
      const index = visible.findIndex((v) => v.entry.seq === seq);
      if (index === -1) return false;
      virtualizer.scrollToIndex(index, { align: 'center' });
      setFlashSeq(seq);
      setTimeout(() => setFlashSeq((cur) => (cur === seq ? null : cur)), 1000);
      return true;
    },
  }), [visible, virtualizer]);

  // Font size changes every rendered row's real height — force a remeasure
  // rather than waiting on each row's own ResizeObserver to individually
  // settle, so the scroll position doesn't visibly jump around meanwhile.
  useEffect(() => { virtualizer.measure(); }, [fontSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Plain scrollTop rather than virtualizer.scrollToIndex(): we only ever
    // want "stick to the bottom," and scrollToIndex's internal flushSync can
    // collide with the rapid successive updates a fast-tailing file
    // produces. The virtualizer's spacer div already reports the true total
    // height, so this still lands exactly at the bottom.
    if (autoscroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visible.length, autoscroll]);

  return (
    <div className="log-view">
      <div className="log-toolbar-info">
        <span className={`status-dot status-${status || 'idle'}`} />
        <span className="counts">{matchCount} / {effectiveBuffer.length}</span>
        {compiled.error && <span className="jql-error">{compiled.error}</span>}
        {paused && <span className="paused-hint">Paused</span>}
      </div>
      <LogHeader
        columns={extraColumns}
        onRemoveColumn={onRemoveColumn}
        tsWidth={tsWidth}
        badgeWidth={badgeWidth}
        extraColumnWidth={extraColumnWidth}
        onResizeColumn={onResizeColumn}
      />
      <div className={`log ${wrap ? '' : 'no-wrap'}`} ref={scrollRef} style={{ fontSize: `${fontSize}px` }}>
        {visible.length === 0 && (
          <div className="empty">{effectiveBuffer.length === 0 ? 'No lines yet.' : 'No lines match the current filter.'}</div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const { entry, isMatch } = visible[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
              >
                <LineRow
                  entry={entry}
                  terms={compiled.terms}
                  isMatch={isMatch}
                  queryActive={queryActive}
                  highlightOnly={highlightOnly}
                  caseSensitive={caseSensitive}
                  timestamp={ownTimestamp(entry.text)}
                  expanded={expandedSeqs.has(entry.seq)}
                  onToggleExpand={toggleExpanded}
                  pinned={pinnedSeqs.has(entry.seq)}
                  onTogglePinned={togglePinned}
                  flash={flashSeq === entry.seq}
                  columns={extraColumns}
                  onToggleColumn={onToggleColumn}
                  tsWidth={tsWidth}
                  badgeWidth={badgeWidth}
                  extraColumnWidth={extraColumnWidth}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
