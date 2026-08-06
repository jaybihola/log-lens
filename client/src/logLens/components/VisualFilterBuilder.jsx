import { Fragment, useMemo } from 'react';
import { Popover } from '../../shared/components/Popover.jsx';
import { Tooltip } from '../../shared/components/Tooltip.jsx';
import { FilterClauseEditor, NEW_GROUP } from './FilterClauseEditor.jsx';
import { clauseLabel, composeQuery, decomposeQuery } from '../filter/visualClauses.js';

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// Kibana-style pill row for building JQL visually — fully derived from (and
// writes straight back to) the tab's normal filterQuery string, so there's
// no separate "visual state" to keep in sync or lose on toggle. Groups AND
// their own clauses and OR against each other; which group a filter joins
// is chosen right in its own add/edit form (see FilterClauseEditor), not by
// building a whole group up front — dragging a filter to a different group
// later is just re-editing it and picking a different one.
export function VisualFilterBuilder({ query, onChange, fields, buffer }) {
  const { groups, advanced } = useMemo(() => decomposeQuery(query), [query]);

  const commit = (nextGroups) => onChange(composeQuery(nextGroups, advanced));
  const clearAdvanced = () => onChange(composeQuery(groups, ''));

  const removeClause = (groupIndex, clauseIndex) => {
    const next = groups
      .map((g, gi) => (gi === groupIndex ? { ...g, clauses: g.clauses.filter((_, ci) => ci !== clauseIndex) } : g))
      .filter((g) => g.clauses.length > 0);
    commit(next);
  };

  // Adding and editing both land here: place `clause` into `groupChoice`
  // (an existing group id, or NEW_GROUP for a fresh OR'd group), first
  // removing it from wherever it used to live (a no-op for a new clause).
  const placeClause = (clause, groupChoice, fromGroupIndex, fromClauseIndex) => {
    let next = groups.map((g) => ({ ...g, clauses: [...g.clauses] }));
    if (fromGroupIndex !== undefined) next[fromGroupIndex].clauses.splice(fromClauseIndex, 1);
    if (groupChoice === NEW_GROUP) {
      next.push({ id: `g${Date.now()}`, clauses: [clause] });
    } else {
      const gi = next.findIndex((g) => g.id === groupChoice);
      if (gi === -1) next.push({ id: `g${Date.now()}`, clauses: [clause] });
      else next[gi] = { ...next[gi], clauses: [...next[gi].clauses, clause] };
    }
    commit(next.filter((g) => g.clauses.length > 0));
  };

  return (
    <div className="visual-filter-bar">
      {advanced && (
        <Tooltip label="Advanced filter" description={advanced}>
          <span className="filter-pill filter-pill-advanced">
            <span className="filter-pill-text">Advanced: {truncate(advanced, 40)}</span>
            <button type="button" onClick={clearAdvanced}>×</button>
          </span>
        </Tooltip>
      )}

      {groups.map((group, gi) => (
        <Fragment key={group.id}>
          {gi > 0 && <span className="filter-group-or">OR</span>}
          <div className="filter-group-box">
            {groups.length > 1 && <span className="filter-group-tag">{`G${gi + 1}`}</span>}
            {group.clauses.map((clause, ci) => (
              <Popover
                key={clause.id}
                trigger={(toggle, open) => (
                  <span className={open ? 'filter-pill active' : 'filter-pill'}>
                    <span className="filter-pill-text" onClick={toggle}>{clauseLabel(clause)}</span>
                    <button type="button" onClick={() => removeClause(gi, ci)}>×</button>
                  </span>
                )}
              >
                {(close) => (
                  <FilterClauseEditor
                    initial={clause}
                    initialGroupId={group.id}
                    groups={groups}
                    fields={fields}
                    buffer={buffer}
                    onSave={(next, groupChoice) => { placeClause(next, groupChoice, gi, ci); close(); }}
                    onCancel={close}
                  />
                )}
              </Popover>
            ))}
          </div>
        </Fragment>
      ))}

      <Popover
        trigger={(toggle, open) => (
          <button type="button" className={open ? 'filter-pill-add active' : 'filter-pill-add'} onClick={toggle}>+ Add filter</button>
        )}
      >
        {(close) => (
          <FilterClauseEditor
            initial={null}
            groups={groups}
            fields={fields}
            buffer={buffer}
            onSave={(next, groupChoice) => { placeClause(next, groupChoice); close(); }}
            onCancel={close}
          />
        )}
      </Popover>
    </div>
  );
}
