# diffLens/

Diff Lens's own components/hooks/diff-logic — nothing outside this directory
(other than `shared/`, `shell/`, or the top-level `App.jsx`) imports from
here, and this directory should never import from `logLens/`/`jsonLens/`.
v1 is paste-only: no server routes, no `api/` folder, no file/scratch
backing — tabs are just autosaved to localStorage (`useDiffTabs.js`).

## Top level

| File | What |
|---|---|
| `DiffLensApp.jsx` | The tool's top-level component — tabs, toolbar, and whichever diff view is active. No decision-modal state machine like JSON Lens's, since there's nothing durable to save/discard |
| `DiffLens.css` | This tool's own styling, including the `cm-*` overrides for `@codemirror/merge`'s diff decorations |

## `components/`

| File | What |
|---|---|
| `DiffToolbar.jsx` | View toggle, language picker, ignore-options popover, collapse-unchanged toggle, prev/next-change + stats, swap, wrap/zoom, copy/export popover, clear |
| `DiffTabBar.jsx` | Leaner sibling of `jsonLens/components/JsonTabBar.jsx` — no dirty dot or save-related menu items, same overflow-scroll behavior |
| `DiffSideBySideView.jsx` | Wraps `@codemirror/merge`'s `MergeView` — the one place in the app that talks to raw `@codemirror/state`/`@codemirror/view` instead of going through `<CodeMirror>` (`@uiw/react-codemirror` only wraps a single `EditorView`; `MergeView` is its own imperative class managing two). Both panes are directly editable — pasting into either one *is* how a tab's `leftText`/`rightText` get set |
| `DiffUnifiedView.jsx` | `unifiedMergeView()` as a plain extension on a normal `<CodeMirror>` — fits the existing declarative pattern (`shared/components/JsonEditor.jsx`) exactly, unlike the side-by-side view. Read-only: editing happens in Side-by-side |

## `diff/`

| File | What |
|---|---|
| `languages.js` | value → CodeMirror language extension map for the dropdown, plus `detectLanguage()` — deliberately narrow (valid-JSON and tag-soup-looking-like-XML/HTML only); everything else stays plain text until picked manually |
| `diffEngine.js` | `buildDiffOverride(options)` — when any ignore-option (whitespace/case/blank-lines/line-endings) is active, replaces `@codemirror/merge`'s own diff algorithm with a line-level LCS over normalized lines (the library has no "equality comparator" hook, only a full-algorithm override). Trade-off: word/char intraline highlighting is lost while any ignore-option is active — a changed line just shows as changed. Falls back to the library's own precise `diff()` above ~1M kept-line cells rather than rebuilding a huge LCS table on every keystroke |
| `patchFormat.js` | `buildUnifiedDiff(leftText, rightText, chunks)` — turns a `Chunk[]` (from `MergeView.chunks`/`getChunks()`, always line-aligned) into standard unified-diff/`.patch` text, used by "Copy as patch"/"Download .patch". No `\ No newline at end of file` marker — not aiming for byte-exact `git apply` fidelity on that one edge case |
| `cmTheme.js` | Shared CodeMirror chrome theme (`makeSizeTheme`, following `--panel`/`--fg`) and syntax `HighlightStyle` (`diffHighlighting`), used by both view components so they render identically |

## `hooks/`

| File | What |
|---|---|
| `useDiffTabs.js` | Tabs: entirely localStorage, modeled on `jsonLens/hooks/useJsonTabs.js` but with no dirty/save lifecycle — a diff tab has nothing durable to diverge from |

## Side-by-side vs. Unified

`@codemirror/merge` gives two fundamentally different primitives:
`MergeView` (two real, separately-editable `EditorView`s kept in sync) for
side-by-side, and `unifiedMergeView()` (a plain extension diffing one
editor's content against a fixed `original` string) for unified. Editing
only ever happens in Side-by-side — Unified is a deliberately read-only
review mode (`editable={false}`/`readOnly` on its `<CodeMirror>`): letting
you type into the "current" side while the *other* side's deleted-line
widgets sit interleaved read-only above it was confusing (which side am I
editing?), not a useful shortcut.

## A real @codemirror/merge gotcha: `reconfigure()` doesn't re-diff

`MergeView.reconfigure({ diffConfig })` only stores the new config for
*future* incremental updates (`Chunk.updateA`/`updateB`) — reading its
source (`dist/index.js`), it never re-runs `Chunk.build` against the chunks
already on screen. So `DiffSideBySideView.jsx` fully rebuilds the `MergeView`
whenever an ignore-option changes, rather than reconfiguring in place —
otherwise toggling ignore-whitespace/case/etc. would silently leave the
previous diff on screen until the next real edit. `collapseUnchanged` has
its own dedicated compartment in the library and doesn't have this problem,
so it stays on the cheap reconfigure path. `DiffUnifiedView.jsx` doesn't need
the same workaround: its `unifiedMergeView(...)` extension is rebuilt fresh
via `useMemo` on every options change and swapped in through
`@uiw/react-codemirror`'s own compartment handling, which is a genuine field
*add* (forcing re-initialization) rather than a reconfigure of a live one.
