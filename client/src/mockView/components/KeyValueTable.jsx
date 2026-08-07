import { Trash2 } from 'lucide-react';

function makeRowId() {
  return `kv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// The editable Params/Headers row table — also reused by the environment
// editor for its variable list. Always keeps one trailing blank row so
// there's somewhere to type a new entry without an explicit "+" click first;
// that blank row is dropped from what's persisted (see MockViewApp/
// useMockCollections callers, which filter empty-key rows before saving).
export function KeyValueTable({ rows, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }) {
  const withBlankRow = rows.length && rows[rows.length - 1].key === '' ? rows : [...rows, { id: makeRowId(), key: '', value: '', enabled: true }];

  const updateRow = (id, patch) => {
    const next = withBlankRow.map((r) => (r.id === id ? { ...r, ...patch } : r));
    onChange(next.filter((r, i) => r.key !== '' || i < next.length - 1));
  };
  const removeRow = (id) => onChange(withBlankRow.filter((r) => r.id !== id));

  return (
    <table className="mock-kv">
      <thead>
        <tr><th style={{ width: 28 }}></th><th>{keyPlaceholder}</th><th>{valuePlaceholder}</th><th style={{ width: 32 }}></th></tr>
      </thead>
      <tbody>
        {withBlankRow.map((row) => (
          <tr key={row.id} className={row.enabled === false ? 'kv-row-disabled' : ''}>
            <td>
              <input
                type="checkbox"
                checked={row.enabled !== false}
                onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
              />
            </td>
            <td>
              <input
                type="text"
                value={row.key}
                placeholder={keyPlaceholder}
                onChange={(e) => updateRow(row.id, { key: e.target.value })}
              />
            </td>
            <td>
              <input
                type="text"
                value={row.value}
                placeholder={valuePlaceholder}
                onChange={(e) => updateRow(row.id, { value: e.target.value })}
              />
            </td>
            <td>
              {row.key !== '' && (
                <button type="button" className="icon-btn kv-remove" onClick={() => removeRow(row.id)}>
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
