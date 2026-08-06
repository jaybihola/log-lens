import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { getJsonValueType, jsonValuePreview, parseJsonForTable } from '../jsonUtils.js';

// One row (key/type/value), recursing into its own <tbody> of child rows
// when expanded — kept as a real nested <table> per expandable value rather
// than flattening into one big table with indentation-only nesting, since
// that's what lets each subtree's expand state live as ordinary component
// state (no path-keyed Set to maintain) and keeps column alignment sane at
// any depth.
function TableRow({ rowKey, value, depth, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const type = getJsonValueType(value);
  const isContainer = type === 'object' || type === 'array';
  const expandable = isContainer && jsonValueSize(value) > 0;

  return (
    <>
      <tr className="json-table-row">
        <td className="json-table-key-cell" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
          {expandable ? (
            <button
              type="button"
              className="json-table-toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight size={12} strokeWidth={2} className={expanded ? 'json-table-chevron expanded' : 'json-table-chevron'} />
            </button>
          ) : (
            <span className="json-table-toggle-spacer" />
          )}
          <span className="json-table-key">{rowKey}</span>
        </td>
        <td className="json-table-type-cell">
          <span className={`json-table-type json-table-type-${type}`}>{type}</span>
        </td>
        <td className="json-table-value-cell">
          {isContainer ? (
            <span className="json-table-preview">{jsonValuePreview(value)}</span>
          ) : (
            <span className={`json-table-scalar json-table-scalar-${type}`}>{formatScalar(value, type)}</span>
          )}
        </td>
      </tr>
      {expandable && expanded && (
        type === 'array'
          ? value.map((item, i) => (
            <TableRow key={i} rowKey={`[${i}]`} value={item} depth={depth + 1} defaultExpanded={false} />
          ))
          : Object.entries(value).map(([k, v]) => (
            <TableRow key={k} rowKey={k} value={v} depth={depth + 1} defaultExpanded={false} />
          ))
      )}
    </>
  );
}

function jsonValueSize(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

function formatScalar(value, type) {
  if (type === 'string') return `"${value}"`;
  if (type === 'null') return 'null';
  return String(value);
}

// Read-only tabular rendering of a JSON document — nested objects/arrays
// expand in place rather than syntax-highlighted text, for scanning a
// document's shape rather than reading it verbatim. `text` is whatever the
// caller currently has displayed (full content or a field-filtered subset —
// this component doesn't know or care which).
export function JsonTableView({ text }) {
  const parsed = parseJsonForTable(text);

  if (!text?.trim()) {
    return <div className="json-table-empty">Nothing to show.</div>;
  }
  if (!parsed.ok) {
    return <div className="json-table-empty json-table-error">Fix the JSON error in Edit mode to view it as a table.</div>;
  }

  const { value } = parsed;
  const rootType = getJsonValueType(value);
  const rootEntries = rootType === 'array'
    ? value.map((item, i) => [`[${i}]`, item])
    : rootType === 'object'
      ? Object.entries(value)
      : [['(root)', value]];

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
          {rootEntries.map(([k, v]) => (
            <TableRow key={k} rowKey={k} value={v} depth={0} defaultExpanded={false} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
