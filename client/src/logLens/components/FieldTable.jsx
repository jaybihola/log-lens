import { Plus, Check, Filter, FilterX } from 'lucide-react';
import { buildFieldRows } from '../render/fieldTable.js';
import { CopyButton } from '../../shared/components/CopyButton.jsx';
import { Tooltip } from '../../shared/components/Tooltip.jsx';

// Kibana-style expanded-document field grid: per-row Copy / toggle-as-column
// / filter-for / filter-out, as compact icon buttons that reveal on row
// hover — the same interaction FieldsSidebar's own leaf rows already use for
// its Plus/Check column toggle, so a field reads the same way whether you
// found it here or in the sidebar. `onApplyFilter` is null-safe (nothing to
// filter with outside a real log tab's own JQL box), same guard already
// used for `onSendToJsonLens` elsewhere in this tree.
export function FieldTable({ entry, pairedSeq, timeLabel, levelLabel, columns, onToggleColumn, onApplyFilter }) {
  const rows = buildFieldRows(entry, { pairedSeq, timeLabel, levelLabel });

  return (
    <table className="field-table">
      <tbody>
        {rows.map((row) => {
          const isColumn = row.keyPath && columns.includes(row.keyPath);
          return (
            <tr key={row.label}>
              <th>{row.label}</th>
              <td>{row.value}</td>
              <td className="field-actions-cell">
                <div className="field-actions">
                  <CopyButton
                    text={row.value}
                    className="field-action-btn"
                    title="Copy value"
                    description={`Copy ${row.label}'s value to the clipboard.`}
                    iconOnly
                  />
                  {row.keyPath && onApplyFilter && (
                    <>
                      <Tooltip label="Filter for this value" description={`Add ${row.label}:${row.value} to the filter.`}>
                        <button
                          type="button"
                          className="field-action-btn"
                          onClick={(e) => { e.stopPropagation(); onApplyFilter(row.keyPath, row.value, false); }}
                        >
                          <Filter size={13} strokeWidth={1.75} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Filter out this value" description={`Exclude ${row.label}:${row.value} from the filter.`}>
                        <button
                          type="button"
                          className="field-action-btn field-action-btn-exclude"
                          onClick={(e) => { e.stopPropagation(); onApplyFilter(row.keyPath, row.value, true); }}
                        >
                          <FilterX size={13} strokeWidth={1.75} />
                        </button>
                      </Tooltip>
                    </>
                  )}
                  {row.keyPath && (
                    <Tooltip label={isColumn ? 'Remove column' : 'Add as column'} description={isColumn ? 'Stop showing this field as its own column.' : 'Show this field as its own column in the log list.'}>
                      <button
                        type="button"
                        className={isColumn ? 'field-action-btn active' : 'field-action-btn'}
                        onClick={(e) => { e.stopPropagation(); onToggleColumn(row.keyPath); }}
                      >
                        {isColumn ? <Check size={13} strokeWidth={2} /> : <Plus size={13} strokeWidth={1.75} />}
                      </button>
                    </Tooltip>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
