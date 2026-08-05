import { useIndexFields } from '../../hooks/useIndexFields.js';

// Path-autocompletes against the index's real field names so a fold filter
// can be pointed at a real field instead of a hand-typed guess. A plain
// <datalist> is enough here — native browser autocomplete, no custom
// dropdown/positioning needed.
export function FoldFilterRow({ environment, indexPattern, filter, datalistId, onChange, onRemove }) {
  const fields = useIndexFields(environment, indexPattern);

  return (
    <div className="settings-row">
      <input type="text" placeholder="key" value={filter.key} onChange={(e) => onChange({ key: e.target.value })} />
      <input type="text" placeholder="label" value={filter.label} onChange={(e) => onChange({ label: e.target.value })} />
      <input
        type="text"
        placeholder="json.path"
        value={filter.path}
        list={datalistId}
        onChange={(e) => onChange({ path: e.target.value })}
      />
      <datalist id={datalistId}>
        {fields.map((f) => <option key={f.name} value={f.name} />)}
      </datalist>
      <input
        type="text"
        placeholder="preset values, comma-separated (optional)"
        value={filter.presetValuesText}
        onChange={(e) => onChange({ presetValuesText: e.target.value })}
      />
      <button type="button" onClick={onRemove}>×</button>
    </div>
  );
}
