import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  getJsonValueType, jsonValuePreview, parseJsonForTable, formatScalarText,
  jsonChildEntries, jsonPathKey, jsonMatchKey,
} from '../jsonUtils.js';

const EMPTY_SET = new Set();

// Wraps every occurrence of `query` in `text` with a highlight <mark> —
// mirrors Log Lens's applyTermHits, just operating on a plain React string
// instead of an HTML blob since table cells don't render raw HTML. `active`
// marks this cell as the current find-bar step (a stronger highlight, same
// idea as Log Lens's .find-current row background).
function HighlightedText({ text, query, caseSensitive, active }) {
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  if (!needle) return text;
  const parts = [];
  let last = 0;
  let idx = hay.indexOf(needle);
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <mark key={idx} className={active ? 'json-find-hit json-find-current' : 'json-find-hit'}>
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    last = idx + needle.length;
    idx = hay.indexOf(needle, last);
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// One row (key/type/value), recursing into its own <tbody> of child rows
// when expanded — kept as a real nested <table> per expandable value rather
// than flattening into one big table with indentation-only nesting, since
// that's what lets each subtree's expand state live as ordinary component
// state (no path-keyed Set to maintain) and keeps column alignment sane at
// any depth.
//
// `localExpanded` starts at `null` ("unset — follow the find bar's forced
// expand") rather than `defaultExpanded` directly, so stepping to a match
// can force this row open without that forcing becoming sticky: once the
// user explicitly toggles it, their choice wins from then on; until they
// do, it just tracks whichever match is currently active.
function TableRow({
  rowKey, value, depth, defaultExpanded, path,
  matchSet, activeKey, activeRowKey, forcedExpandPaths, query, caseSensitive,
}) {
  const [localExpanded, setLocalExpanded] = useState(null);
  const rowRef = useRef(null);
  const type = getJsonValueType(value);
  const isContainer = type === 'object' || type === 'array';
  const expandable = isContainer && jsonValueSize(value) > 0;
  const pathK = jsonPathKey(path);
  const forceExpanded = forcedExpandPaths.has(pathK);
  const expanded = localExpanded !== null ? localExpanded : (defaultExpanded || forceExpanded);
  const isActiveRow = activeRowKey === pathK;
  const keyHit = matchSet.has(`${pathK}|key`);
  const valueHit = matchSet.has(`${pathK}|value`);

  useEffect(() => {
    if (isActiveRow) rowRef.current?.scrollIntoView({ block: 'center' });
  }, [isActiveRow, activeKey]);

  return (
    <>
      <tr ref={rowRef} className={isActiveRow ? 'json-table-row json-table-row-current' : 'json-table-row'}>
        <td className="json-table-key-cell" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
          {expandable ? (
            <button
              type="button"
              className="json-table-toggle"
              onClick={() => setLocalExpanded(!expanded)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight size={12} strokeWidth={2} className={expanded ? 'json-table-chevron expanded' : 'json-table-chevron'} />
            </button>
          ) : (
            <span className="json-table-toggle-spacer" />
          )}
          <span className="json-table-key">
            {keyHit ? <HighlightedText text={rowKey} query={query} caseSensitive={caseSensitive} active={activeKey === `${pathK}|key`} /> : rowKey}
          </span>
        </td>
        <td className="json-table-type-cell">
          <span className={`json-table-type json-table-type-${type}`}>{type}</span>
        </td>
        <td className="json-table-value-cell">
          {isContainer ? (
            <span className="json-table-preview">{jsonValuePreview(value)}</span>
          ) : (
            <span className={`json-table-scalar json-table-scalar-${type}`}>
              {valueHit
                ? <HighlightedText text={formatScalarText(value, type)} query={query} caseSensitive={caseSensitive} active={activeKey === `${pathK}|value`} />
                : formatScalarText(value, type)}
            </span>
          )}
        </td>
      </tr>
      {expandable && expanded && jsonChildEntries(value).map((child) => (
        <TableRow
          key={child.rawKey}
          rowKey={child.displayKey}
          value={child.value}
          depth={depth + 1}
          defaultExpanded={false}
          path={[...path, child.rawKey]}
          matchSet={matchSet}
          activeKey={activeKey}
          activeRowKey={activeRowKey}
          forcedExpandPaths={forcedExpandPaths}
          query={query}
          caseSensitive={caseSensitive}
        />
      ))}
    </>
  );
}

function jsonValueSize(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

// Read-only tabular rendering of a JSON document — nested objects/arrays
// expand in place rather than syntax-highlighted text, for scanning a
// document's shape rather than reading it verbatim. `text` is whatever the
// caller currently has displayed (full content or a field-filtered subset —
// this component doesn't know or care which).
//
// `matches`/`activeMatch`/`query`/`caseSensitive` are the find-in-view
// bar's output (see jsonUtils.js's findJsonMatches) — all optional, so this
// component behaves exactly as before when nothing is searching.
export function JsonTableView({ text, matches = [], activeMatch = null, query = '', caseSensitive = false }) {
  const parsed = parseJsonForTable(text);

  const matchSet = useMemo(() => new Set(matches.map(jsonMatchKey)), [matches]);
  const activeKey = activeMatch ? jsonMatchKey(activeMatch) : null;
  const activeRowKey = activeMatch ? jsonPathKey(activeMatch.path) : null;
  // Every proper ancestor of the active match's path needs to be expanded
  // for that row to actually be visible — not the whole match set, so
  // stepping between matches doesn't leave every branch of the tree pried
  // open at once.
  const forcedExpandPaths = useMemo(() => {
    if (!activeMatch) return EMPTY_SET;
    const set = new Set();
    for (let i = 1; i < activeMatch.path.length; i += 1) set.add(jsonPathKey(activeMatch.path.slice(0, i)));
    return set;
  }, [activeMatch]);

  if (!text?.trim()) {
    return <div className="json-table-empty">Nothing to show.</div>;
  }
  if (!parsed.ok) {
    return <div className="json-table-empty json-table-error">Fix the JSON error in Edit mode to view it as a table.</div>;
  }

  const { value } = parsed;
  const rootType = getJsonValueType(value);
  const rootEntries = rootType === 'array' || rootType === 'object'
    ? jsonChildEntries(value)
    : [{ rawKey: null, displayKey: '(root)', value }];

  if (rootEntries.length === 0) {
    return <div className="json-table-empty">{rootType === 'array' ? 'Empty array.' : 'Empty object.'}</div>;
  }

  return (
    <div className="json-table-view">
      <table className="json-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rootEntries.map((entry) => (
            <TableRow
              key={entry.rawKey === null ? '(root)' : entry.rawKey}
              rowKey={entry.displayKey}
              value={entry.value}
              depth={0}
              defaultExpanded={false}
              path={entry.rawKey === null ? [] : [entry.rawKey]}
              matchSet={matchSet}
              activeKey={activeKey}
              activeRowKey={activeRowKey}
              forcedExpandPaths={forcedExpandPaths}
              query={query}
              caseSensitive={caseSensitive}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
