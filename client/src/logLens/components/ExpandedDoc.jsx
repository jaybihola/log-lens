import { useState } from 'react';
import { FieldTable } from './FieldTable.jsx';
import { CodeViewer } from './CodeViewer.jsx';

// Kibana-style "expanded document": a flattened field->value table (default)
// plus a raw/pretty JSON tab, shown inline below a row when its "Show more"
// button is toggled.
export function ExpandedDoc({ entry, pairedSeq, timeLabel, levelLabel, columns, onToggleColumn, onApplyFilter, stagedFilters, onToggleStagedFilter }) {
  const [activeTab, setActiveTab] = useState('table');

  return (
    <div className="expanded-doc" onClick={(e) => e.stopPropagation()}>
      <div className="expanded-doc-tabs">
        <div className="expanded-doc-tab-group">
          <button
            type="button"
            className={activeTab === 'table' ? 'expanded-doc-tab active' : 'expanded-doc-tab'}
            onClick={() => setActiveTab('table')}
          >
            Table
          </button>
          <button
            type="button"
            className={activeTab === 'json' ? 'expanded-doc-tab active' : 'expanded-doc-tab'}
            onClick={() => setActiveTab('json')}
          >
            JSON
          </button>
        </div>
      </div>
      <div className="expanded-doc-body">
        {activeTab === 'table' ? (
          <FieldTable
            entry={entry}
            pairedSeq={pairedSeq}
            timeLabel={timeLabel}
            levelLabel={levelLabel}
            columns={columns}
            onToggleColumn={onToggleColumn}
            onApplyFilter={onApplyFilter}
            stagedFilters={stagedFilters}
            onToggleStagedFilter={onToggleStagedFilter}
          />
        ) : (
          <CodeViewer rawText={entry.text} />
        )}
      </div>
    </div>
  );
}
