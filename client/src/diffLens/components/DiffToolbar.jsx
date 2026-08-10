import {
  Columns2, Rows3, ArrowLeftRight, SlidersHorizontal, FoldVertical,
  ChevronUp, ChevronDown, WrapText, ZoomIn, ZoomOut, Copy, Check,
  ClipboardCopy, Download, Trash2, Save,
} from 'lucide-react';
import { Tooltip } from '../../shared/components/Tooltip.jsx';
import { Dropdown } from '../../shared/components/Dropdown.jsx';
import { Popover } from '../../shared/components/Popover.jsx';
import { LANGUAGES } from '../diff/languages.js';

const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l.value, label: l.label }));

const IGNORE_OPTIONS = [
  { key: 'ignoreWhitespace', label: 'Ignore whitespace', description: 'Trims and collapses runs of spaces/tabs before comparing.' },
  { key: 'ignoreCase', label: 'Ignore case', description: 'Uppercase and lowercase compare as equal.' },
  { key: 'ignoreBlankLines', label: 'Ignore blank lines', description: 'Blank lines never count as an addition or removal.' },
  { key: 'ignoreLineEndings', label: 'Ignore line endings', description: 'CRLF and LF compare as equal.' },
];

function classifyChunks(chunks) {
  let added = 0;
  let removed = 0;
  let modified = 0;
  for (const c of chunks) {
    const emptyA = c.toA === c.fromA;
    const emptyB = c.toB === c.fromB;
    if (emptyA && !emptyB) added++;
    else if (emptyB && !emptyA) removed++;
    else modified++;
  }
  return { added, removed, modified, total: chunks.length };
}

export function DiffToolbar({
  language, onSetLanguage,
  viewMode, onSetViewMode,
  options, onSetOption,
  collapseUnchanged, onToggleCollapseUnchanged,
  chunks, onGoNext, onGoPrevious,
  onSwap,
  wrap, onToggleWrap,
  fontSize, minFontSize, maxFontSize, onStepFontSize,
  hasContent,
  dirty, onSave,
  copyStatus, onCopyLeft, onCopyRight, onCopyPatch, onDownloadPatch,
  onClear,
}) {
  const stats = classifyChunks(chunks);
  const ignoreActiveCount = IGNORE_OPTIONS.filter((o) => options[o.key]).length;

  return (
    <div className="diff-toolbar">
      <div className="diff-mode-toggle">
        <Tooltip label="Side by side" description="Two panes, both directly editable — the classic diff-tool layout.">
          <button type="button" className={viewMode === 'side-by-side' ? 'active icon-btn' : 'icon-btn'} onClick={() => onSetViewMode('side-by-side')}>
            <Columns2 size={15} strokeWidth={1.75} />
          </button>
        </Tooltip>
        <Tooltip label="Unified" description="Single pane, +/- interleaved — read-only. Switch to Side by side to edit.">
          <button type="button" className={viewMode === 'unified' ? 'active icon-btn' : 'icon-btn'} onClick={() => onSetViewMode('unified')}>
            <Rows3 size={15} strokeWidth={1.75} />
          </button>
        </Tooltip>
      </div>

      <span className="diff-toolbar-divider" />

      <Tooltip label="Save" description="Save this comparison as a scratch, so it shows up in the sidebar for quick access later.">
        <button type="button" className="icon-btn" onClick={onSave} disabled={!dirty}>
          <Save size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>

      <span className="diff-toolbar-divider" />

      <Dropdown
        className="diff-language-dropdown"
        value={language}
        options={LANGUAGE_OPTIONS}
        onChange={onSetLanguage}
      />

      <Popover
        align="left"
        trigger={(toggle, open) => (
          <Tooltip label="Ignore options" description="Normalize before comparing — whitespace, case, blank lines, line endings.">
            <button type="button" className={open || ignoreActiveCount ? 'active icon-btn' : 'icon-btn'} onClick={toggle}>
              <SlidersHorizontal size={15} strokeWidth={1.75} />
              {ignoreActiveCount > 0 && <span className="diff-ignore-badge">{ignoreActiveCount}</span>}
            </button>
          </Tooltip>
        )}
        panelClassName="diff-ignore-panel"
      >
        {() => (
          <div className="diff-ignore-options">
            {IGNORE_OPTIONS.map((opt) => (
              <label key={opt.key} className="diff-ignore-option" title={opt.description}>
                <input
                  type="checkbox"
                  checked={!!options[opt.key]}
                  onChange={(e) => onSetOption(opt.key, e.target.checked)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
            <p className="diff-ignore-note">While any of these are on, changed lines show as fully changed rather than word-highlighted.</p>
          </div>
        )}
      </Popover>

      <Tooltip label={collapseUnchanged ? 'Showing collapsed unchanged regions' : 'Unchanged regions expanded'} description="Collapse long stretches of identical lines.">
        <button type="button" className={collapseUnchanged ? 'active icon-btn' : 'icon-btn'} onClick={onToggleCollapseUnchanged}>
          <FoldVertical size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>

      <span className="diff-toolbar-divider" />

      <Tooltip label="Previous change" description="Jump to the previous changed chunk.">
        <button type="button" className="icon-btn" onClick={onGoPrevious} disabled={!stats.total}>
          <ChevronUp size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Next change" description="Jump to the next changed chunk.">
        <button type="button" className="icon-btn" onClick={onGoNext} disabled={!stats.total}>
          <ChevronDown size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <span className="diff-stats">
        {stats.total === 0 ? 'No differences' : (
          <>
            <span className="diff-stat-added">+{stats.added}</span>
            <span className="diff-stat-removed">-{stats.removed}</span>
            <span className="diff-stat-modified">~{stats.modified}</span>
          </>
        )}
      </span>

      <span className="diff-toolbar-divider" />

      <Tooltip label="Swap sides" description="Swap the left and right text.">
        <button type="button" className="icon-btn" onClick={onSwap} disabled={!hasContent}>
          <ArrowLeftRight size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Wrap lines" description="Wrap long lines instead of scrolling horizontally.">
        <button type="button" className={wrap ? 'active icon-btn' : 'icon-btn'} onClick={onToggleWrap}>
          <WrapText size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Zoom out" description="Shrink the editor's font size.">
        <button type="button" className="icon-btn" onClick={() => onStepFontSize(-1)} disabled={fontSize <= minFontSize}>
          <ZoomOut size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <Tooltip label="Zoom in" description="Enlarge the editor's font size.">
        <button type="button" className="icon-btn" onClick={() => onStepFontSize(1)} disabled={fontSize >= maxFontSize}>
          <ZoomIn size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>

      <span className="diff-toolbar-divider" />

      <Popover
        align="right"
        trigger={(toggle) => (
          <Tooltip label={copyStatus || 'Copy / export'} description="Copy either side, or the diff as a unified patch.">
            <button type="button" className="icon-btn" onClick={toggle}>
              {copyStatus === 'Copied' ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
            </button>
          </Tooltip>
        )}
        panelClassName="diff-copy-panel"
      >
        {(close) => (
          <div className="diff-copy-menu">
            <button type="button" onClick={() => { onCopyLeft(); close(); }} disabled={!hasContent}>Copy left</button>
            <button type="button" onClick={() => { onCopyRight(); close(); }} disabled={!hasContent}>Copy right</button>
            <button type="button" onClick={() => { onCopyPatch(); close(); }} disabled={!stats.total}>
              <ClipboardCopy size={13} strokeWidth={1.75} /> Copy as patch
            </button>
            <button type="button" onClick={() => { onDownloadPatch(); close(); }} disabled={!stats.total}>
              <Download size={13} strokeWidth={1.75} /> Download .patch
            </button>
          </div>
        )}
      </Popover>

      <Tooltip label="Clear" description="Empty both sides of this tab.">
        <button type="button" className="icon-btn" onClick={onClear} disabled={!hasContent}>
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>
    </div>
  );
}
