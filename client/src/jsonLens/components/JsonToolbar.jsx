import {
  AlignLeft, Minimize2, ArrowDownAZ, WrapText, Copy, Check, Download, Upload, Trash2,
  Save, SaveAll, Undo2, Redo2, Search, FoldVertical, UnfoldVertical, Hash,
  ZoomIn, ZoomOut, ChevronsLeftRight, ChevronsRightLeft, Pencil, Eye, Code2, Table2,
} from 'lucide-react';
import { Tooltip } from '../../shared/components/Tooltip.jsx';

const INDENT_OPTIONS = [
  [2, '2 spaces'],
  [4, '4 spaces'],
  ['tab', 'Tab'],
];

// Log Lens's sibling is components/Toolbar.jsx — same shape (renders its own
// wrapper div, takes values + callbacks as flat props, no internal state of
// its own beyond what's purely toolbar-local). Extracted from what used to
// be ~170 lines inline in JsonFormatterApp.jsx; pure refactor, no behavior
// change.
export function JsonToolbar({
  activeTab, mode, onSetMode, isViewMode, viewSubMode, onSetViewSubMode,
  dirty, content, displayedText, validation,
  onSave, onSaveAs, fileInputRef, onImportFile,
  onDownload,
  onUndo, onRedo,
  findOpen, onToggleFind,
  onGotoLine,
  onFormat, onMinify, sortKeys, onToggleSortKeys, onEscape, onUnescape,
  indent, onIndentChange,
  wrap, onToggleWrap, onFoldAll, onUnfoldAll,
  fontSize, minFontSize, maxFontSize, onStepFontSize,
  copyStatus, onCopy, onClear,
}) {
  const tableViewActive = isViewMode && viewSubMode === 'table';

  return (
    <div className="json-toolbar">
      <div className="json-mode-toggle">
        <Tooltip label="Edit" description="Edit the raw JSON — the field filter is hidden here so nothing gets in the way.">
          <button type="button" className={mode === 'edit' ? 'active icon-btn' : 'icon-btn'} onClick={() => onSetMode('edit')} disabled={!activeTab}>
            <Pencil size={15} strokeWidth={1.75} />
            <span className="json-mode-toggle-label">Edit</span>
          </button>
        </Tooltip>
        <Tooltip label="View" description="Read-only viewing, with field-filtering available.">
          <button type="button" className={isViewMode ? 'active icon-btn' : 'icon-btn'} onClick={() => onSetMode('view')} disabled={!activeTab}>
            <Eye size={15} strokeWidth={1.75} />
            <span className="json-mode-toggle-label">View</span>
          </button>
        </Tooltip>
      </div>

      {isViewMode && (
        <div className="json-mode-toggle">
          <Tooltip label="Code view" description="Read-only syntax-highlighted text.">
            <button type="button" className={viewSubMode === 'code' ? 'active icon-btn' : 'icon-btn'} onClick={() => onSetViewSubMode('code')}>
              <Code2 size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Table view" description="Nested objects/arrays as an expandable table.">
            <button type="button" className={viewSubMode === 'table' ? 'active icon-btn' : 'icon-btn'} onClick={() => onSetViewSubMode('table')}>
              <Table2 size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>
      )}

      <span className="json-toolbar-divider" />

      {mode === 'edit' && (
        <>
          <Tooltip label="Save" description={activeTab?.origin === 'new' ? 'Choose where to save this tab.' : 'Write this tab back to where it came from.'}>
            <button type="button" className="icon-btn" onClick={onSave} disabled={!activeTab || !dirty}>
              <Save size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Save as…" description="Save this tab's content to a new file on disk.">
            <button type="button" className="icon-btn" onClick={onSaveAs} disabled={!activeTab || !content.trim()}>
              <SaveAll size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Import file…" description="Load a .json file into this tab.">
            <button type="button" className="icon-btn" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <input ref={fileInputRef} type="file" accept=".json,application/json,text/plain" style={{ display: 'none' }} onChange={onImportFile} />
        </>
      )}
      <Tooltip label="Download" description="Save what's currently shown as a .json file.">
        <button type="button" className="icon-btn" onClick={onDownload} disabled={!displayedText.trim()}>
          <Download size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>

      <span className="json-toolbar-divider" />

      {mode === 'edit' && (
        <>
          <Tooltip label="Undo" description="Undo the last edit.">
            <button type="button" className="icon-btn" onClick={onUndo} disabled={!activeTab}>
              <Undo2 size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Redo" description="Redo the last undone edit.">
            <button type="button" className="icon-btn" onClick={onRedo} disabled={!activeTab}>
              <Redo2 size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </>
      )}
      <Tooltip
        label={isViewMode ? 'Find in view' : 'Find / Replace'}
        description={isViewMode ? "Highlight and step through matches — doesn't change what's shown (Cmd/Ctrl+F)." : "Open the editor's search panel."}
      >
        <button
          type="button"
          className={isViewMode && findOpen ? 'active icon-btn' : 'icon-btn'}
          onClick={onToggleFind}
          disabled={!activeTab}
        >
          <Search size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Go to line…" description="Jump the cursor to a specific line number.">
        <button type="button" className="icon-btn" onClick={onGotoLine} disabled={!activeTab || tableViewActive}>
          <Hash size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>

      {mode === 'edit' && (
        <>
          <span className="json-toolbar-divider" />

          <Tooltip label="Format" description="Pretty-print with the selected indent.">
            <button type="button" className="icon-btn" onClick={onFormat} disabled={!content.trim() || !validation.valid}>
              <AlignLeft size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Minify" description="Collapse to a single line.">
            <button type="button" className="icon-btn" onClick={onMinify} disabled={!content.trim() || !validation.valid}>
              <Minimize2 size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Sort keys" description="Alphabetize object keys when formatting or minifying.">
            <button type="button" className={sortKeys ? 'active icon-btn' : 'icon-btn'} onClick={onToggleSortKeys}>
              <ArrowDownAZ size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Escape" description="Wrap the current content as a JSON string literal, for embedding it as a value elsewhere.">
            <button type="button" className="icon-btn" onClick={onEscape} disabled={!content.trim()}>
              <ChevronsRightLeft size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Unescape" description="Decode a JSON string literal (e.g. pasted from a log field) back into real JSON.">
            <button type="button" className="icon-btn" onClick={onUnescape} disabled={!content.trim()}>
              <ChevronsLeftRight size={15} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <select value={indent} onChange={(e) => onIndentChange(e.target.value === 'tab' ? 'tab' : Number(e.target.value))}>
            {INDENT_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </>
      )}

      <span className="json-toolbar-divider" />

      <Tooltip label="Wrap lines" description="Wrap long lines instead of scrolling horizontally.">
        <button type="button" className={wrap ? 'active icon-btn' : 'icon-btn'} onClick={onToggleWrap} disabled={tableViewActive}>
          <WrapText size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Fold all" description="Collapse every object and array.">
        <button type="button" className="icon-btn" onClick={onFoldAll} disabled={!activeTab || tableViewActive}>
          <FoldVertical size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Unfold all" description="Expand every collapsed object and array.">
        <button type="button" className="icon-btn" onClick={onUnfoldAll} disabled={!activeTab || tableViewActive}>
          <UnfoldVertical size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Zoom out" description="Shrink the editor's font size.">
        <button type="button" className="icon-btn" onClick={() => onStepFontSize(-1)} disabled={fontSize <= minFontSize || tableViewActive}>
          <ZoomOut size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Zoom in" description="Enlarge the editor's font size.">
        <button type="button" className="icon-btn" onClick={() => onStepFontSize(1)} disabled={fontSize >= maxFontSize || tableViewActive}>
          <ZoomIn size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>

      <span className="json-toolbar-divider" />

      <Tooltip label={copyStatus || 'Copy'} description="Copy what's currently shown to the clipboard.">
        <button type="button" className="icon-btn" onClick={onCopy} disabled={!displayedText.trim()}>
          {copyStatus === 'Copied' ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
        </button>
      </Tooltip>
      {mode === 'edit' && (
        <Tooltip label="Clear" description="Empty this tab.">
          <button type="button" className="icon-btn" onClick={onClear} disabled={!content.trim()}>
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </Tooltip>
      )}
      <span className={content.trim() ? `json-validation ${validation.valid ? 'ok' : 'error'}` : 'json-validation'}>
        {content.trim() ? (validation.valid ? 'Valid JSON' : validation.error) : ''}
      </span>
    </div>
  );
}
