import { useState } from 'react';
import { FieldTable } from './FieldTable.jsx';
import { CodeViewer } from './CodeViewer.jsx';

// Kibana-style "expanded document": a flattened field->value table (default)
// plus a raw/pretty JSON tab, shown inline below a row when its "Show more"
// button is toggled.
export function ExpandedDoc({ entry, pairedSeq, timeLabel, levelLabel, columns, onToggleColumn, onApplyFilter, stagedFilters, onToggleStagedFilter }) {
  const [activeTab, setActiveTab] = useState('table');

  return (
    // tabIndex={-1} makes this div itself a valid click-focus target — not
    // just a container someone might have focus "inside." That alone covers
    // most of its content (a click on a non-focusable descendant like a
    // table cell or a <button> — which, on macOS, doesn't itself take
    // keyboard focus on click — walks up to the nearest focusable ancestor
    // per the HTML spec's focusing steps), but not the JSON tab's read-only
    // (editable={false}) CodeMirror instance: it runs its own mousedown
    // handling for text-selection purposes, which suppresses the browser's
    // default focus-follows-click behavior entirely. The explicit
    // onMouseDownCapture below runs before that (or any) descendant's own
    // handler, so it always lands regardless of what a nested widget does
    // with the event afterward — giving LogViewerApp's ⌘F scoping a reliable
    // signal via document.activeElement.closest('.expanded-doc') no matter
    // which sub-view (Table or JSON) was actually clicked.
    <div
      className="expanded-doc"
      data-seq={entry.seq}
      tabIndex={-1}
      onMouseDownCapture={(e) => e.currentTarget.focus()}
      onClick={(e) => e.stopPropagation()}
    >
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
