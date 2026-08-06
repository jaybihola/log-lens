import { Wand2, RefreshCw, Pause, Play, Trash2, Search, Bookmark, Settings2, MoreHorizontal } from 'lucide-react';
import { Popover } from '../../shared/components/Popover.jsx';
import { Tooltip } from '../../shared/components/Tooltip.jsx';
import { Dropdown } from '../../shared/components/Dropdown.jsx';
import { PresetsMenu } from './PresetsMenu.jsx';
import { MoreMenu } from './MoreMenu.jsx';
import { FilterInput } from './FilterInput.jsx';
import { VisualFilterBuilder } from './VisualFilterBuilder.jsx';

const AUTO_REFRESH_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
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
  histogramOpen, onToggleHistogram,
  tabLabel,
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
      <Tooltip
        label={filterMode === 'visual' ? 'Switch to text filter' : 'Visual filter builder'}
        description={filterMode === 'visual' ? 'Edit the raw JQL text instead of the pill builder.' : 'Build your JQL filter with dropdowns and pills instead of typing it.'}
      >
        <button type="button" className={filterMode === 'visual' ? 'active icon-btn' : 'icon-btn'} onClick={onToggleFilterMode}>
          <Wand2 size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>

      {isApiTab && (
        <Tooltip label={fetching ? 'Fetching…' : 'Fetch new'} description="Re-run this tab's query against the remote index.">
          <button type="button" className="icon-btn" onClick={onFetch} disabled={fetching}>
            <RefreshCw size={15} strokeWidth={1.75} className={fetching ? 'spin' : ''} />
          </button>
        </Tooltip>
      )}

      <Tooltip
        label={paused ? 'Resume' : 'Pause'}
        description={paused ? 'Start streaming new lines again.' : 'Stop new lines from streaming in while you inspect what\'s on screen.'}
      >
        <button type="button" className={paused ? 'active icon-btn' : 'icon-btn'} onClick={() => onChange({ paused: !paused })}>
          {paused ? <Play size={15} strokeWidth={1.75} /> : <Pause size={15} strokeWidth={1.75} />}
        </button>
      </Tooltip>
      <Tooltip label="Clear" description="Empty this tab's view (doesn't touch the source file or index).">
        <button type="button" className="icon-btn" onClick={onClear}>
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Find in view" description="Highlight and step through matches without filtering anything out. (⌘F / Ctrl+F)">
        <button type="button" className="icon-btn" onClick={onOpenFind}>
          <Search size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>

      <Popover
        align="right"
        trigger={(toggle, open) => (
          <Tooltip label="Presets" description="Save and reapply frequently-used JQL filters." disabled={open}>
            <button type="button" className={open ? 'active icon-btn' : 'icon-btn'} onClick={toggle}>
              <Bookmark size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
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
          <Tooltip label="View options" description="Case sensitivity, line wrap, autoscroll, font size, and auto-refresh." disabled={open}>
            <button type="button" className={open ? 'active icon-btn' : 'icon-btn'} onClick={toggle}>
              <Settings2 size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
        )}
      >
        <div className="view-menu">
          <button
            type="button"
            className={caseSensitive ? 'view-menu-toggle active' : 'view-menu-toggle'}
            onClick={() => onChange({ caseSensitive: !caseSensitive })}
          >
            <span>Case-sensitive</span>
            <span className="view-menu-toggle-indicator" />
          </button>
          <button
            type="button"
            className={wrap ? 'view-menu-toggle active' : 'view-menu-toggle'}
            onClick={() => onChange({ wrap: !wrap })}
          >
            <span>Wrap lines</span>
            <span className="view-menu-toggle-indicator" />
          </button>
          <button
            type="button"
            className={histogramOpen ? 'view-menu-toggle active' : 'view-menu-toggle'}
            onClick={onToggleHistogram}
          >
            <span>Time histogram</span>
            <span className="view-menu-toggle-indicator" />
          </button>
          {!isApiTab && (
            <button
              type="button"
              className={autoscroll ? 'view-menu-toggle active' : 'view-menu-toggle'}
              onClick={() => onChange({ autoscroll: !autoscroll })}
            >
              <span>Autoscroll</span>
              <span className="view-menu-toggle-indicator" />
            </button>
          )}
          <div className="view-menu-divider" />
          <div className="view-menu-row">
            <span>Font size</span>
            <span className="font-stepper">
              <Tooltip label="Decrease font size" placement="right"><button type="button" onClick={() => onStepFontSize(-0.5)}>A-</button></Tooltip>
              <span className="font-stepper-value">{fontSize}</span>
              <Tooltip label="Increase font size" placement="right"><button type="button" onClick={() => onStepFontSize(0.5)}>A+</button></Tooltip>
            </span>
          </div>
          {isApiTab && (
            <div className="view-menu-row">
              <span>Auto-refresh</span>
              <Dropdown
                align="right"
                className="auto-refresh-dropdown"
                value={autoRefreshSec}
                options={AUTO_REFRESH_OPTIONS}
                onChange={(v) => onChange({ autoRefreshSec: Number(v) })}
              />
            </div>
          )}
        </div>
      </Popover>

      <Popover
        align="right"
        trigger={(toggle, open) => (
          <Tooltip label="More" description="Pinned lines, jump to line, and this tab's extra columns." disabled={open}>
            <button type="button" className={open ? 'active icon-btn' : 'icon-btn'} onClick={toggle}>
              <MoreHorizontal size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
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
          ui={ui}
          tabLabel={tabLabel}
        />
      </Popover>
    </div>
  );
}
