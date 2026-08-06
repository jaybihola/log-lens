import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { compileQuery } from '../filter/compile.js';
import { ownTimestamp } from '../render/timestamp.js';
import { LineRow } from './LineRow.jsx';
import { LogHeader } from './LogHeader.jsx';
import { FindBar } from './FindBar.jsx';

export const EntryView = forwardRef(function EntryView({
  buffer, ui, status, fontSize,
  toggleExpanded, togglePinned,
  extraColumns, onToggleColumn, onRemoveColumn,
  tsWidth, badgeWidth, extraColumnWidth, onResizeColumn,
  findOpen, onCloseFind,
}, ref) {
  const { filterQuery, caseSensitive, autoscroll, paused, wrap, expandedSeqs, pinnedSeqs } = ui;
  const scrollRef = useRef(null);
  const pausedSnapshotRef = useRef(null);
  const [flashSeq, setFlashSeq] = useState(null);

  const [findQuery, setFindQuery] = useState('');
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [findIndex, setFindIndex] = useState(0);

  if (!paused) pausedSnapshotRef.current = null;
  const effectiveBuffer = paused
    ? (pausedSnapshotRef.current ??= buffer)
    : buffer;

  const compiled = useMemo(() => compileQuery(filterQuery, { caseSensitive }), [filterQuery, caseSensitive]);
  const queryActive = filterQuery.trim().length > 0;

  // The filter box actually filters (removes non-matching lines) — there's
  // no "highlight only" mode here anymore. Finding without removing lines
  // is the find bar's job (below), scoped to whatever this has already
  // narrowed things down to.
  const visible = useMemo(() => {
    if (!queryActive) return effectiveBuffer.map((entry) => ({ entry }));
    return effectiveBuffer.filter((entry) => compiled.matcher(entry.text)).map((entry) => ({ entry }));
  }, [effectiveBuffer, compiled, queryActive]);

  const matchCount = visible.length;

  const findCompiled = useMemo(() => compileQuery(findQuery, { caseSensitive: findCaseSensitive }), [findQuery, findCaseSensitive]);
  const findActive = findOpen && findQuery.trim().length > 0;
  const findMatchSeqs = useMemo(() => (
    findActive ? visible.filter((v) => findCompiled.matcher(v.entry.text)).map((v) => v.entry.seq) : []
  ), [visible, findCompiled, findActive]);
  // Unlike `flash` (a one-second pulse shared with jump-to-line), this stays
  // on the current match for as long as it *is* current — the persistent
  // "you are here" indicator the flash alone doesn't give you while
  // stepping through find results.
  const currentFindSeq = findMatchSeqs.length ? findMatchSeqs[findIndex] : null;

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

  // Jump to a specific seq (pinned-line navigation, jump-to-line/timestamp,
  // find-bar navigation) — only works if that entry is in the currently
  // filtered/visible set. Briefly flashes the target row so a jump to an
  // already-on-screen line is still noticeable.
  const scrollToSeqInternal = (seq) => {
    const index = visible.findIndex((v) => v.entry.seq === seq);
    if (index === -1) return false;
    virtualizer.scrollToIndex(index, { align: 'center' });
    setFlashSeq(seq);
    setTimeout(() => setFlashSeq((cur) => (cur === seq ? null : cur)), 1000);
    return true;
  };

  useImperativeHandle(ref, () => ({ scrollToSeq: scrollToSeqInternal }), [visible, virtualizer]);

  // Typing a new find query (or flipping case-sensitivity) jumps to the
  // first match, same as a browser's find-in-page — but new lines streaming
  // in and happening to match shouldn't yank you away from wherever you
  // currently are, so this deliberately doesn't depend on findMatchSeqs.
  useEffect(() => {
    if (!findActive || findMatchSeqs.length === 0) return;
    setFindIndex(0);
    scrollToSeqInternal(findMatchSeqs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findQuery, findCaseSensitive]);

  useEffect(() => {
    if (!findOpen) { setFindQuery(''); setFindIndex(0); }
  }, [findOpen]);

  const gotoFindIndex = (i) => {
    if (!findMatchSeqs.length) return;
    const wrapped = ((i % findMatchSeqs.length) + findMatchSeqs.length) % findMatchSeqs.length;
    setFindIndex(wrapped);
    scrollToSeqInternal(findMatchSeqs[wrapped]);
  };

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
      <div className="log-body">
        {findOpen && (
          <FindBar
            query={findQuery}
            onQueryChange={setFindQuery}
            caseSensitive={findCaseSensitive}
            onToggleCaseSensitive={() => setFindCaseSensitive((v) => !v)}
            matchCount={findMatchSeqs.length}
            currentIndex={findIndex}
            onNext={() => gotoFindIndex(findIndex + 1)}
            onPrev={() => gotoFindIndex(findIndex - 1)}
            onClose={onCloseFind}
          />
        )}
        <div className={`log ${wrap ? '' : 'no-wrap'}`} ref={scrollRef} style={{ fontSize: `${fontSize}px` }}>
          {visible.length === 0 && (
            <div className="empty">{effectiveBuffer.length === 0 ? 'No lines yet.' : 'No lines match the current filter.'}</div>
          )}
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const { entry } = visible[virtualRow.index];
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
                    caseSensitive={caseSensitive}
                    findTerms={findActive ? findCompiled.terms : null}
                    findCaseSensitive={findCaseSensitive}
                    isCurrentFindMatch={entry.seq === currentFindSeq}
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
    </div>
  );
});
