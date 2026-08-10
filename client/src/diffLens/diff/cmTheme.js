import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Chrome (background/gutters/selection) — matches the app's --panel/--fg
// CSS variables exactly like shared/components/JsonEditor.jsx's makeTheme,
// so this follows the light/dark toggle automatically. `fontSize` is the
// only thing that varies per render (the toolbar's zoom).
export const makeSizeTheme = (fontSize) => EditorView.theme({
  '&': { backgroundColor: 'var(--panel)', color: 'var(--fg)', fontSize: `${fontSize}px`, height: '100%' },
  '.cm-content': { fontFamily: "'SF Mono', Consolas, monospace", caretColor: 'var(--fg)' },
  '.cm-gutters': { backgroundColor: 'var(--panel-2)', color: 'var(--dim)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(var(--accent-rgb), 0.06)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(var(--accent-rgb), 0.08)' },
  // Unlike JsonEditor (one editor among many controls), each pane here *is*
  // the primary input surface — an invisible focus state made it read as
  // static/non-interactive, so this gets a real ring instead of `outline: none`.
  '&.cm-editor.cm-focused': { outline: 'none', boxShadow: 'inset 0 0 0 2px rgba(var(--accent-rgb), 0.5)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(var(--accent-rgb), 0.25) !important' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-placeholder': { color: 'var(--dimmer)', fontStyle: 'italic' },
});

// Tag -> color mapping shared across every language we support — deliberately
// generic (keyword/string/number/comment/etc.) rather than per-language,
// since one HighlightStyle already covers the common lezer tag vocabulary
// most of these grammars emit. Diff-specific insert/delete/changed coloring
// lives in DiffLens.css instead (see cm-changedLine etc. there), since those
// don't depend on the parsed syntax tree at all.
const diffHighlightStyleDef = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--syntax-bool)' },
  { tag: [t.string, t.regexp], color: 'var(--syntax-string)' },
  { tag: t.number, color: 'var(--syntax-number)' },
  { tag: [t.bool, t.null], color: 'var(--syntax-bool)' },
  { tag: t.comment, color: 'var(--dim)', fontStyle: 'italic' },
  { tag: [t.punctuation, t.separator, t.squareBracket, t.brace, t.paren, t.angleBracket], color: 'var(--syntax-punct)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syntax-key)' },
  { tag: t.propertyName, color: 'var(--syntax-key)' },
  { tag: [t.typeName, t.className], color: 'var(--syntax-tag)' },
  { tag: t.tagName, color: 'var(--syntax-tag)' },
  { tag: t.attributeName, color: 'var(--syntax-attr)' },
  { tag: t.attributeValue, color: 'var(--syntax-string)' },
  { tag: t.operator, color: 'var(--syntax-punct)' },
  { tag: t.invalid, color: 'var(--error)' },
]);

export const diffHighlighting = syntaxHighlighting(diffHighlightStyleDef);
