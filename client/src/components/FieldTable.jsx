import { buildFieldRows } from '../render/fieldTable.js';
import { CopyButton } from './CopyButton.jsx';

export function FieldTable({ entry, pairedSeq, timeLabel, levelLabel, columns, onToggleColumn }) {
  const rows = buildFieldRows(entry, { pairedSeq, timeLabel, levelLabel });

  return (
    <table className="field-table">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th>{row.label}</th>
            <td>{row.value}</td>
            <td className="field-toggle-cell">
              <CopyButton text={row.value} className="field-toggle-btn" title={`Copy ${row.label}`} />
              {row.keyPath && (
                <button
                  type="button"
                  className={columns.includes(row.keyPath) ? 'field-toggle-btn active' : 'field-toggle-btn'}
                  onClick={(e) => { e.stopPropagation(); onToggleColumn(row.keyPath); }}
                >
                  {columns.includes(row.keyPath) ? '✓ Column' : '+ Column'}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
