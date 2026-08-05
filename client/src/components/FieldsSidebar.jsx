import { useMemo, useRef, useState } from 'react';
import { FieldStatsPopover } from './FieldStatsPopover.jsx';

const SHOW_DELAY_MS = 350;
// Grace period before hiding, so moving the cursor from the row to the
// popover (to click a value) doesn't dismiss it mid-transit — the popover
// itself also cancels this on its own mouseenter.
const HIDE_DELAY_MS = 200;

// Kibana-style "available fields" panel for the active tab: a searchable
// list of the index's cached fields (name + type, from useIndexFields),
// split into what's already a column and what isn't, each one-click to
// toggle as a column via the same onToggleColumn used by the field
// table/expanded-doc "+ Column" buttons. Hovering a row (briefly, to avoid
// recomputing on every row while scanning the list) shows its top-value
// distribution, computed from the tab's own buffer — see FieldStatsPopover.
export function FieldsSidebar({ buffer, fields, columns, onToggleColumn, onApplyFilter }) {
  const [search, setSearch] = useState('');
  const [hover, setHover] = useState(null); // { field, top, left } | null
  const showTimer = useRef(null);
  const hideTimer = useRef(null);

  const columnSet = useMemo(() => new Set(columns), [columns]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? fields.filter((f) => f.name.toLowerCase().includes(q)) : fields;
  }, [fields, search]);

  const selected = filtered.filter((f) => columnSet.has(f.name));
  const available = filtered.filter((f) => !columnSet.has(f.name));

  const scheduleShow = (fieldName, rect) => {
    clearTimeout(hideTimer.current);
    clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      setHover({ field: fieldName, top: rect.top, left: rect.right + 8 });
    }, SHOW_DELAY_MS);
  };
  const scheduleHide = () => {
    clearTimeout(showTimer.current);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHover(null), HIDE_DELAY_MS);
  };
  const cancelHide = () => clearTimeout(hideTimer.current);
  const hideNow = () => {
    clearTimeout(showTimer.current);
    clearTimeout(hideTimer.current);
    setHover(null);
  };

  return (
    <aside className="fields-sidebar">
      <input
        type="text"
        className="fields-sidebar-search"
        placeholder="Search fields…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {fields.length === 0 ? (
        <p className="creds-hint fields-sidebar-empty">
          No cached fields for this tab — open a remote-query tab pointed at an index to browse its fields here.
        </p>
      ) : (
        <div className="fields-sidebar-list">
          {selected.length > 0 && (
            <div className="fields-sidebar-section">
              <label>Selected columns ({selected.length})</label>
              {selected.map((f) => (
                <FieldRow
                  key={f.name}
                  field={f}
                  active
                  onClick={() => onToggleColumn(f.name)}
                  onHover={(rect) => scheduleShow(f.name, rect)}
                  onUnhover={scheduleHide}
                />
              ))}
            </div>
          )}
          <div className="fields-sidebar-section">
            <label>Available fields ({available.length})</label>
            {available.length === 0 ? (
              <p className="picker-empty">No matching fields.</p>
            ) : (
              available.map((f) => (
                <FieldRow
                  key={f.name}
                  field={f}
                  active={false}
                  onClick={() => onToggleColumn(f.name)}
                  onHover={(rect) => scheduleShow(f.name, rect)}
                  onUnhover={scheduleHide}
                />
              ))
            )}
          </div>
        </div>
      )}
      {hover && (
        <FieldStatsPopover
          buffer={buffer}
          field={hover.field}
          top={hover.top}
          left={hover.left}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          onApply={(field, value) => { onApplyFilter(field, value); hideNow(); }}
        />
      )}
    </aside>
  );
}

function FieldRow({ field, active, onClick, onHover, onUnhover }) {
  return (
    <button
      type="button"
      className={active ? 'fields-sidebar-row active' : 'fields-sidebar-row'}
      onClick={onClick}
      onMouseEnter={(e) => onHover(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={onUnhover}
    >
      <span className="fields-sidebar-row-name">{field.name}</span>
      <span className="fields-sidebar-row-type">{field.type}</span>
      <span className="fields-sidebar-row-toggle">{active ? '✓' : '+'}</span>
    </button>
  );
}
