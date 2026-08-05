import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Matches the app's existing --panel-2/--fg/etc CSS variables (see
// index.css :root) rather than pulling in a separate theme package — stays
// in sync with the rest of the UI automatically, including the light/dark
// toggle. This only styles editor chrome (background, gutters, selection) —
// token colors are a separate concern, below.
const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--panel-2)', color: 'var(--fg)', fontSize: '12.5px' },
  '.cm-content': { fontFamily: "'SF Mono', Consolas, monospace", caretColor: 'var(--fg)' },
  '.cm-gutters': { backgroundColor: 'var(--panel)', color: 'var(--dim)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(var(--accent-rgb), 0.06)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(var(--accent-rgb), 0.08)' },
  '&.cm-editor.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(var(--accent-rgb), 0.25) !important' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(var(--accent-rgb), 0.25)', outline: 'none' },
  '.cm-foldPlaceholder': { background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--dim)' },
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

export function JsonEditor({ value, onChange, readOnly = false, language = 'json', minHeight = '80px', maxHeight = '420px' }) {
  return (
    <CodeMirror
      value={value}
      className="json-editor"
      theme={theme}
      extensions={[language === 'xml' ? xml() : json(), syntaxHighlighting(jsonHighlightStyle)]}
      editable={!readOnly}
      readOnly={readOnly}
      minHeight={minHeight}
      maxHeight={maxHeight}
      basicSetup={{ highlightActiveLine: !readOnly, highlightActiveLineGutter: !readOnly }}
      onChange={onChange}
    />
  );
}
