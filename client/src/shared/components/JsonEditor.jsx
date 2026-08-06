import { forwardRef, useImperativeHandle, useRef } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { HighlightStyle, syntaxHighlighting, syntaxTree, foldAll, unfoldAll } from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { undo, redo } from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import { tags as t } from '@lezer/highlight';
import { locateJsonError } from '../../jsonLens/jsonUtils.js';

// Matches the app's existing --panel-2/--fg/etc CSS variables (see
// index.css :root) rather than pulling in a separate theme package — stays
// in sync with the rest of the UI automatically, including the light/dark
// toggle. This only styles editor chrome (background, gutters, selection) —
// token colors are a separate concern, below. `fontSize` is the one bit that
// varies per render (the toolbar's zoom in/out), so the theme is built fresh
// from it rather than being a single frozen extension.
const makeTheme = (fontSize) => EditorView.theme({
  '&': { backgroundColor: 'var(--panel-2)', color: 'var(--fg)', fontSize: `${fontSize}px` },
  '.cm-content': { fontFamily: "'SF Mono', Consolas, monospace", caretColor: 'var(--fg)' },
  '.cm-gutters': { backgroundColor: 'var(--panel)', color: 'var(--dim)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(var(--accent-rgb), 0.06)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(var(--accent-rgb), 0.08)' },
  '&.cm-editor.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(var(--accent-rgb), 0.25) !important' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(var(--accent-rgb), 0.25)', outline: 'none' },
  '.cm-foldPlaceholder': { background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--dim)' },
  '.cm-lintRange-error': { backgroundImage: 'none', borderBottom: '1.5px dotted var(--error)' },
  '.cm-lintRange-warning': { backgroundImage: 'none', borderBottom: '1.5px dotted var(--warn, #c9a227)' },
  '.cm-tooltip-lint': {
    backgroundColor: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--fg)',
    fontSize: '12px', borderRadius: '6px', boxShadow: 'var(--shadow)',
  },
  '.cm-diagnostic': { padding: '4px 8px' },
  '.cm-diagnostic-error': { borderLeft: '3px solid var(--error)' },
  '.cm-diagnostic-warning': { borderLeft: '3px solid var(--warn, #c9a227)' },
  '.cm-gutter-lint': { width: '1.1em' },
});

// Lezer highlight tags -> colors, via the same --syntax-* variables as the
// app's own .jk/.js/.jn/.jb/.jz/.jp classes (render/highlight.js + App.css)
// so a JSON entry looks the same whether it's rendered inline or in this
// editor, in either theme.
const jsonHighlightStyle = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--syntax-key)' }, // object keys
  { tag: t.string, color: 'var(--syntax-string)' },
  { tag: t.number, color: 'var(--syntax-number)' },
  { tag: [t.bool, t.null], color: 'var(--syntax-bool)' },
  { tag: [t.punctuation, t.separator, t.squareBracket, t.brace, t.paren], color: 'var(--syntax-punct)' },
  { tag: t.keyword, color: 'var(--syntax-bool)' },
  { tag: t.tagName, color: 'var(--syntax-tag)' }, // XML
  { tag: t.attributeName, color: 'var(--syntax-attr)' },
  { tag: t.attributeValue, color: 'var(--syntax-string)' },
  { tag: t.angleBracket, color: 'var(--syntax-punct)' },
  { tag: t.invalid, color: 'var(--error)' },
]);

// Every object literal's *own* keys (not nested ones — those get their own
// Object node and are checked independently) — flags a key repeated within
// the same object, which JSON.parse silently resolves by keeping the last
// occurrence. Walking the real syntax tree (rather than a regex over the
// text) means this can't be confused by a string value that happens to
// contain something that looks like a key.
function duplicateKeyDiagnostics(state) {
  const diagnostics = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Object') return;
      const seen = new Map();
      for (let child = node.node.firstChild; child; child = child.nextSibling) {
        if (child.name !== 'Property') continue;
        const nameNode = child.firstChild;
        if (!nameNode || nameNode.name !== 'PropertyName') continue;
        let key;
        try {
          key = JSON.parse(state.sliceDoc(nameNode.from, nameNode.to));
        } catch {
          continue; // malformed literal — the parse-error diagnostic already covers this
        }
        if (seen.has(key)) {
          diagnostics.push({
            from: nameNode.from,
            to: nameNode.to,
            severity: 'warning',
            message: `Duplicate key "${key}" — only the last value is kept.`,
          });
        }
        seen.set(key, true);
      }
    },
  });
  return diagnostics;
}

// A single JSON.parse failure only reports one error at a time (the parser
// stops at the first problem) — surfaced as one diagnostic anchored at the
// exact offset when the engine's message gives one, else at the very end of
// the document (better than not showing anything).
function jsonLinter(view) {
  const text = view.state.doc.toString();
  const parseError = locateJsonError(text);
  const diagnostics = parseError
    ? [{
      from: Math.min(parseError.pos ?? text.length, text.length),
      to: Math.min((parseError.pos ?? text.length) + 1, text.length),
      severity: 'error',
      message: parseError.message,
    }]
    : duplicateKeyDiagnostics(view.state);
  return diagnostics;
}

// forwardRef exposes a handful of editor commands (undo/redo/find/fold/
// go-to-line) that only make sense dispatched against the live CodeMirror
// view, not as whole-document string transforms the way Format/Minify are —
// so a toolbar living outside this component (JsonFormatterApp's) can still
// drive them. Optional: callers that don't pass a ref (RemoteQueryBody,
// CodeViewer) are unaffected.
export const JsonEditor = forwardRef(function JsonEditor({
  value, onChange, readOnly = false, language = 'json', wrap = false, fontSize = 12.5,
  height, minHeight = '80px', maxHeight = '420px',
}, ref) {
  const cmRef = useRef(null);

  useImperativeHandle(ref, () => ({
    undo: () => { const v = cmRef.current?.view; if (v) { undo(v); v.focus(); } },
    redo: () => { const v = cmRef.current?.view; if (v) { redo(v); v.focus(); } },
    find: () => { const v = cmRef.current?.view; if (v) openSearchPanel(v); },
    foldAll: () => { const v = cmRef.current?.view; if (v) foldAll(v); },
    unfoldAll: () => { const v = cmRef.current?.view; if (v) unfoldAll(v); },
    gotoLine: (lineNumber) => {
      const v = cmRef.current?.view;
      if (!v) return;
      const clamped = Math.min(Math.max(1, lineNumber), v.state.doc.lines);
      const line = v.state.doc.line(clamped);
      v.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
      v.focus();
    },
    focus: () => cmRef.current?.view?.focus(),
  }), []);

  return (
    <CodeMirror
      ref={cmRef}
      value={value}
      className="json-editor"
      theme={makeTheme(fontSize)}
      extensions={[
        language === 'xml' ? xml() : json(),
        syntaxHighlighting(jsonHighlightStyle),
        ...(language === 'json' ? [linter(jsonLinter), lintGutter()] : []),
        ...(wrap ? [EditorView.lineWrapping] : []),
      ]}
      editable={!readOnly}
      readOnly={readOnly}
      height={height}
      minHeight={height ? undefined : minHeight}
      maxHeight={height ? undefined : maxHeight}
      basicSetup={{ highlightActiveLine: !readOnly, highlightActiveLineGutter: !readOnly }}
      onChange={onChange}
    />
  );
});
