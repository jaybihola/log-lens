import { useMemo, useState } from 'react';
import { OPERATORS, operatorArity } from '../filter/visualClauses.js';
import { computeFieldStats } from '../render/fieldStats.js';
import { Dropdown } from '../../shared/components/Dropdown.jsx';

const FIELD_LIST_ID = 'filter-clause-field-list';
const VALUE_LIST_ID = 'filter-clause-value-list';
export const NEW_GROUP = '__new__';

// Add/edit form for one visual-filter pill — field (free-text + datalist,
// same "type it even if it's not in the cached list" convention as the
// fold-filter path input), operator, however many values that operator
// needs, and how it combines with what's already there. Groups AND their
// own clauses together and OR against each other, so the question is just
// "AND or OR?": OR always starts a fresh group; AND joins an existing one —
// automatically the only group there is, or (when there's more than one) a
// second pick for which one. Value suggestions come from the tab's own
// buffer (computeFieldStats) rather than a backend call, same reasoning as
// the sidebar's stats popover: instant, and scales with what's already
// loaded rather than the index.
export function FilterClauseEditor({ initial, groups, initialGroupId, fields, buffer, onSave, onCancel }) {
  const [field, setField] = useState(initial?.field || '');
  const [operator, setOperator] = useState(initial?.operator || 'is');
  const [values, setValues] = useState(initial?.values || []);
  const [valueDraft, setValueDraft] = useState('');
  const [combineMode, setCombineMode] = useState('and');
  const [groupChoice, setGroupChoice] = useState(initialGroupId || groups[0]?.id || NEW_GROUP);

  const arity = operatorArity(operator);
  const needsGroupPick = combineMode === 'and' && groups.length > 1;
  const target = combineMode === 'or' ? NEW_GROUP : (groups.length > 1 ? groupChoice : (groups[0]?.id || NEW_GROUP));

  const valueSuggestions = useMemo(() => {
    if (!field) return [];
    return computeFieldStats(buffer, field).buckets.map((b) => b.value);
  }, [buffer, field]);

  const addValue = (v) => {
    const trimmed = v.trim();
    if (!trimmed) return;
    setValues((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setValueDraft('');
  };
  const removeValue = (v) => setValues((prev) => prev.filter((x) => x !== v));

  const canSave = field.trim() && (arity === 'none' || (arity === 'one' ? values[0]?.trim() : values.length > 0));

  const save = () => {
    if (!canSave) return;
    const finalValues = arity === 'one' ? [values[0].trim()] : values;
    onSave({ id: initial?.id, field: field.trim(), operator, values: arity === 'none' ? [] : finalValues }, target);
  };

  return (
    <div className="filter-clause-editor">
      <div className="filter-clause-row">
        <label>Field</label>
        <input
          type="text"
          list={FIELD_LIST_ID}
          value={field}
          placeholder="event.type"
          onChange={(e) => setField(e.target.value)}
          autoFocus
        />
        <datalist id={FIELD_LIST_ID}>
          {fields.map((f) => <option key={f.name} value={f.name} />)}
        </datalist>
      </div>

      <div className="filter-clause-row">
        <label>Operator</label>
        <Dropdown
          value={operator}
          options={OPERATORS.map((o) => ({ value: o.id, label: o.label }))}
          onChange={setOperator}
        />
      </div>

      {arity === 'one' && (
        <div className="filter-clause-row">
          <label>Value</label>
          <input
            type="text"
            list={VALUE_LIST_ID}
            value={values[0] || ''}
            onChange={(e) => setValues([e.target.value])}
            placeholder="value"
          />
          <datalist id={VALUE_LIST_ID}>
            {valueSuggestions.map((v) => <option key={v} value={v} />)}
          </datalist>
        </div>
      )}

      {arity === 'many' && (
        <div className="filter-clause-row filter-clause-row-values">
          <label>Values</label>
          <div className="fold-filter-chips">
            {values.map((v) => (
              <span className="preset-chip" key={v}>
                <span className="preset-name">{v}</span>
                <button type="button" onClick={() => removeValue(v)}>×</button>
              </span>
            ))}
            <div className="fold-filter-input-wrap">
              <input
                type="text"
                list={VALUE_LIST_ID}
                value={valueDraft}
                placeholder={values.length ? '' : 'type, Enter to add'}
                onChange={(e) => setValueDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addValue(valueDraft); } }}
              />
              <datalist id={VALUE_LIST_ID}>
                {valueSuggestions.filter((v) => !values.includes(v)).map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>
          </div>
        </div>
      )}

      {arity === 'none' && <p className="creds-hint">No value needed for this operator.</p>}

      <div className="filter-clause-row">
        <label>Combine with existing filters</label>
        <div className="filter-combine-toggle">
          <button type="button" className={combineMode === 'and' ? 'active' : ''} onClick={() => setCombineMode('and')}>AND</button>
          <button type="button" className={combineMode === 'or' ? 'active' : ''} onClick={() => setCombineMode('or')}>OR</button>
        </div>
      </div>

      {needsGroupPick && (
        <div className="filter-clause-row">
          <label>Which group?</label>
          <Dropdown
            value={groupChoice}
            options={groups.map((g, i) => ({
              value: g.id,
              label: `Group ${i + 1} · ${g.clauses.length} filter${g.clauses.length === 1 ? '' : 's'}`,
            }))}
            onChange={setGroupChoice}
          />
        </div>
      )}

      {combineMode === 'or' && <p className="creds-hint">Starts a new OR&apos;d group.</p>}
      {combineMode === 'and' && !needsGroupPick && (
        <p className="creds-hint">{groups.length ? 'Joins the existing group.' : 'Starts the first group.'}</p>
      )}

      <div className="filter-clause-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" disabled={!canSave} onClick={save}>{initial ? 'Save' : 'Add filter'}</button>
      </div>
    </div>
  );
}
