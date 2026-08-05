import { useIndexFields } from '../../hooks/useIndexFields.js';

const TYPE_OPTIONS = [
  'keyword', 'text', 'long', 'integer', 'short', 'byte', 'double', 'float',
  'date', 'boolean', 'ip', 'object', 'nested', 'geo_point',
];

// Read-only list of an index's cached field names + ES-detected types, each
// with a select to pin down a manual override — for when the mapping's guess
// isn't what you want a field treated as. Overrides live in the environment
// draft (fieldTypeOverrides) and are only persisted on the pane's Save,
// mirroring fold filters.
export function IndexFieldTypesTable({ environment, indexPattern, overrides, onChangeOverride }) {
  const fields = useIndexFields(environment, indexPattern);

  if (!environment.trim() || !indexPattern.trim()) return null;
  if (!fields.length) {
    return <p className="creds-hint">No cached fields yet for this index — they populate the first time it's queried.</p>;
  }

  return (
    <div className="field-types-table-wrap">
      <table className="field-types-table">
        <thead>
          <tr><th>Field</th><th>Detected type</th><th>Override</th></tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name}>
              <td className="field-types-name">{f.name}</td>
              <td className="field-types-detected">{f.detectedType}</td>
              <td>
                <select
                  value={overrides[f.name] || ''}
                  onChange={(e) => onChangeOverride(f.name, e.target.value || null)}
                >
                  <option value="">— use detected —</option>
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
