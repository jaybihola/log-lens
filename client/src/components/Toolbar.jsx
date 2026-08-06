import { Popover } from './Popover.jsx';
import { PresetsMenu } from './PresetsMenu.jsx';
import { MoreMenu } from './MoreMenu.jsx';
import { FilterInput } from './FilterInput.jsx';
import { VisualFilterBuilder } from './VisualFilterBuilder.jsx';

const AUTO_REFRESH_OPTIONS = [
  [0, 'Off'],
  [15, '15s'],
  [30, '30s'],
  [60, '60s'],
];

export function Toolbar({
  ui, onChange, onClear, isApiTab, onFetch, fetching,
  fontSize, onStepFontSize,
  presets, currentQuery, onApplyPreset, onSavePreset, onRemovePreset,
  pinnedSeqs, buffer, onJumpToSeq, onUnpin, onJumpQuery,
  columns, onAddColumn, onRemoveColumn,
  indexFields,
  filterInputRef,
  filterMode, onToggleFilterMode,
  onOpenFind,
}) {
  const {
    filterQuery, caseSensitive, autoscroll, paused, wrap, autoRefreshSec,
  } = ui;

  return (
    <div className="toolbar">
      {filterMode === 'visual' ? (
        <VisualFilterBuilder
          query={filterQuery}
          onChange={(v) => onChange({ filterQuery: v })}
          fields={indexFields}
          buffer={buffer}
        />
      ) : (
        <FilterInput
          ref={filterInputRef}
          placeholder='JQL filter — e.g. "mismatched" OR validation -heartbeat  |  event.type:Fetch  ("/" to focus)'
          value={filterQuery}
          onChange={(v) => onChange({ filterQuery: v })}
          fields={indexFields}
        />
      )}
      <button
        type="button"
        className={filterMode === 'visual' ? 'active' : ''}
        title={filterMode === 'visual' ? 'Switch to text filter' : 'Switch to visual filter builder'}
        onClick={onToggleFilterMode}
      >
        ⚏
      </button>

      {isApiTab && (
        <button type="button" onClick={onFetch} disabled={fetching}>{fetching ? 'Fetching…' : 'Fetch new'}</button>
      )}

      <button
        type="button"
        className={paused ? 'active' : ''}
        onClick={() => onChange({ paused: !paused })}
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button type="button" onClick={onClear}>Clear</button>
      <button type="button" title="Find in view (⌘F / Ctrl+F)" onClick={onOpenFind}>Find</button>

      <Popover
        align="right"
        trigger={(toggle, open) => (
          <button type="button" className={open ? 'active' : ''} onClick={toggle}>Presets</button>
        )}
      >
        {(close) => (
          <PresetsMenu
            presets={presets}
            currentQuery={currentQuery}
            onApply={(q) => { onApplyPreset(q); close(); }}
            onSave={onSavePreset}
            onRemove={onRemovePreset}
          />
        )}
      </Popover>

      <Popover
        align="right"
        trigger={(toggle, open) => (
          <button type="button" className={open ? 'active' : ''} onClick={toggle}>View ▾</button>
        )}
      >
        <div className="view-menu">
          <label className="view-menu-check">
            <input type="checkbox" checked={caseSensitive} onChange={() => onChange({ caseSensitive: !caseSensitive })} />
            Case-sensitive
          </label>
          <label className="view-menu-check">
            <input type="checkbox" checked={wrap} onChange={() => onChange({ wrap: !wrap })} />
            Wrap lines
          </label>
          {!isApiTab && (
            <label className="view-menu-check">
              <input type="checkbox" checked={autoscroll} onChange={() => onChange({ autoscroll: !autoscroll })} />
              Autoscroll
            </label>
          )}
          <div className="view-menu-divider" />
          <div className="view-menu-row">
            <span>Font size</span>
            <span className="font-stepper">
              <button type="button" title="Decrease font size" onClick={() => onStepFontSize(-0.5)}>A-</button>
              <span className="font-stepper-value">{fontSize}</span>
              <button type="button" title="Increase font size" onClick={() => onStepFontSize(0.5)}>A+</button>
            </span>
          </div>
          {isApiTab && (
            <div className="view-menu-row">
              <span>Auto-refresh</span>
              <select
                value={autoRefreshSec}
                onChange={(e) => onChange({ autoRefreshSec: Number(e.target.value) })}
              >
                {AUTO_REFRESH_OPTIONS.map(([sec, label]) => <option key={sec} value={sec}>{label}</option>)}
              </select>
            </div>
          )}
        </div>
      </Popover>

      <Popover
        align="right"
        trigger={(toggle, open) => (
          <button type="button" className={open ? 'active' : ''} onClick={toggle}>⋯</button>
        )}
      >
        <MoreMenu
          pinnedSeqs={pinnedSeqs}
          buffer={buffer}
          onJumpToSeq={onJumpToSeq}
          onUnpin={onUnpin}
          onJumpQuery={onJumpQuery}
          columns={columns}
          onAddColumn={onAddColumn}
          onRemoveColumn={onRemoveColumn}
        />
      </Popover>
    </div>
  );
}
