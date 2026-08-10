import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { unifiedMergeView, goToNextChunk, goToPreviousChunk, getChunks } from '@codemirror/merge';
import { languageExtension } from '../diff/languages.js';
import { buildDiffOverride } from '../diff/diffEngine.js';
import { makeSizeTheme, diffHighlighting } from '../diff/cmTheme.js';

// Read-only by design: `unifiedMergeView` diffs a *single* editor's content
// against a fixed `original` doc, so there's no second real editor here the
// way DiffSideBySideView has — letting you type into the "current" side
// while deleted-line widgets from the *other* side sit interleaved read-only
// above it was confusing (which side am I editing?), not a useful shortcut.
// Unified is a pure review mode; all editing happens in Side-by-side.
export const DiffUnifiedView = forwardRef(function DiffUnifiedView({
  leftText, rightText,
  language, options, wrap = false, fontSize = 12.5, collapseUnchanged = true,
  onChunksChange,
}, ref) {
  const cmRef = useRef(null);

  useImperativeHandle(ref, () => ({
    goToNext: () => { const v = cmRef.current?.view; if (v) goToNextChunk(v); },
    goToPrevious: () => { const v = cmRef.current?.view; if (v) goToPreviousChunk(v); },
  }), []);

  const extensions = useMemo(() => [
    languageExtension(language),
    diffHighlighting,
    wrap ? EditorView.lineWrapping : [],
    makeSizeTheme(fontSize),
    unifiedMergeView({
      original: leftText,
      collapseUnchanged: collapseUnchanged ? { margin: 3, minSize: 4 } : undefined,
      diffConfig: { scanLimit: 500, override: buildDiffOverride(options) || undefined },
      mergeControls: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [
    language, wrap, fontSize, leftText, collapseUnchanged,
    options.ignoreWhitespace, options.ignoreCase, options.ignoreBlankLines, options.ignoreLineEndings,
  ]);

  // @uiw/react-codemirror reconfigures its compartments whenever this array
  // changes (same mechanism JsonEditor.jsx relies on) — this effect just
  // rides that to keep the toolbar's stats in sync afterward.
  useEffect(() => {
    const v = cmRef.current?.view;
    if (v) onChunksChange?.(getChunks(v.state)?.chunks ?? []);
  }, [extensions, rightText]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CodeMirror
      ref={cmRef}
      value={rightText}
      className="diff-unified-view"
      extensions={extensions}
      editable={false}
      readOnly
      basicSetup={{ highlightActiveLine: true, highlightActiveLineGutter: true }}
      height="100%"
    />
  );
});
