# jsonLens/

JSON Lens's own components/hooks/api — nothing outside this directory
(other than `shared/`, `shell/`, or the top-level `App.jsx`) imports from
here, and this directory should never import from `logLens/`. See
`docs/ARCHITECTURE.md` for the deeper narrative (the tab origin model,
save/scratch/discard flow, the filesystem hook) — this file is just a map.

## Top level

| File | What |
|---|---|
| `JsonFormatterApp.jsx` | The tool's top-level component — tabs, field-filter, editor, and the save/close-tab decision-modal state machine; the toolbar itself is `components/JsonToolbar.jsx` |
| `jsonUtils.js` | Pure logic: JSON validation/error-location, format/minify/sort-keys, fuzzy field search, field-filter pruning, escape/unescape, table-view helpers (value typing/preview/parsing), find-in-view matchers (`findTextOccurrences` for Code sub-mode, `findJsonMatches` for Table sub-mode) |
| `JsonLens.css` | This tool's own styling |

## `components/`

| File | What |
|---|---|
| `JsonFileSidebar.jsx` | Folder tree + scratches list, built on `shared/components/FieldTree.jsx` |
| `JsonToolbar.jsx` | The toolbar row — mode toggle, save/undo/redo/find, format/minify/sort-keys, wrap/fold/zoom, copy/clear. Same shape/prop-contract convention as Log Lens's `Toolbar.jsx`: renders its own wrapper div, takes values + callbacks as flat props, no state of its own |
| `JsonTabBar.jsx` | JSON Lens's tab strip — dirty dot, rename, same context-menu-stays-active pattern *and* the same overflow-scroll behavior (scroll buttons, `ResizeObserver`) as Log Lens's `TabBar` |
| `JsonTableView.jsx` | View mode's Table sub-mode — key/type/value rows, nested objects/arrays expand in place (each row owns its own expand state, no path-keyed Set to maintain). When the find bar is open, also highlights matching key/value cells, auto-expands ancestor rows so a stepped-to match is never hidden inside a collapsed row, and scrolls the current match into view |
| `JsonFindBar.jsx` | View mode's non-destructive find-in-view bar (query, `n/total`, next/prev, case-sensitivity toggle) — mirrors Log Lens's own `FindBar.jsx` shape/behavior, adapted to a plain substring search over one document instead of a JQL query over a scrolling log stream. Distinct from the field-filter search box below it: find only highlights/steps through matches, the field filter actually prunes what's shown |

## Edit / View mode

Each tab is in one of two modes, tracked in local component state keyed by
tab id (`modeByTab` in `JsonFormatterApp.jsx`) — ephemeral, not persisted to
the tab itself the way `content`/`selectedFields` are, so it resets on
reload but is remembered per tab while switching between open tabs in the
same session.

- **Edit** (default) — the full toolbar (Save/Save as/Import, Undo/Redo,
  Format/Minify/Sort keys/Escape/Unescape/indent, Clear, …), a fully
  editable CodeMirror instance, and the field-filter UI is not rendered at
  all — there's nothing to get in the way of editing the real `content`.
- **View** — read-only, decluttered toolbar (Copy/Download, Wrap,
  Fold/Unfold, Zoom, Find, Go to line only — everything that mutates
  content is hidden), and the field-filter search box/chips become
  available. Two sub-modes, picked via a toggle that only shows up in View
  mode:
  - **Code** — the same read-only CodeMirror rendering the old
    always-on-when-filtering state used, now scoped to View mode.
  - **Table** — `JsonTableView.jsx`: an actual key/type/value table,
    nested objects/arrays expandable in place instead of syntax-highlighted
    text. Respects whatever's currently displayed (full content, or a
    field-filtered subset) the same way the Code sub-mode does.

Field-filtering itself (the fuzzy search + `selectedFields` on the tab) is
unchanged — it now only ever applies while in View mode, across both
sub-modes; switching back to Edit always shows the real, unfiltered,
editable `content`.

## Find-in-view vs. field-filter

View mode has two distinct search affordances that are easy to conflate but
solve different problems:

- **Field-filter** (the fuzzy search box + chips) *prunes* the displayed
  JSON down to just the selected fields — destructive to what's shown
  (though never to the tab's real `content`).
- **Find** (the toolbar's Search button, or Cmd/Ctrl+F while in View mode —
  opens `JsonFindBar.jsx`) never removes anything; it highlights every
  plain-substring match in whatever's currently displayed and lets you step
  through them with Enter/Shift+Enter or the bar's own next/prev buttons,
  same interaction shape as Log Lens's own find-in-view bar.

Find's matching is computed differently per View sub-mode, in
`JsonFormatterApp.jsx`:

- **Code** — `findTextOccurrences` (`jsonUtils.js`) finds plain-text
  offsets in the displayed string; `JsonEditor.jsx` takes those as an
  optional `highlightRanges`/`activeHighlightRange` prop pair, rendering
  them as CodeMirror mark decorations and dispatching a selection +
  `scrollIntoView` at the active one. Both props are additive/optional —
  every other `JsonEditor` caller (Log Lens's `CodeViewer.jsx`,
  `RemoteQueryBody.jsx`) is unaffected.
- **Table** — `findJsonMatches` (`jsonUtils.js`) walks the *parsed* value in
  the same depth-first order `JsonTableView.jsx` renders it, producing
  `{path, field}` matches (`field` is `'key'` or `'value'`) rather than text
  offsets, since a table cell isn't a text offset — `JsonTableView.jsx`
  turns those into cell highlighting, forces open just the active match's
  ancestor rows (not the whole match set, so stepping doesn't pry the whole
  tree open at once), and scrolls the active row into view.

## `hooks/`

| File | What |
|---|---|
| `useJsonTabs.js` | Tabs: almost entirely localStorage (a JSON Lens "tab" is just an editor buffer, no server tab registry to sync). Tracks `origin` (`"new"`/`"file"`/`"scratch"`), `content` vs. `savedContent` for dirty-checking, exports `isTabDirty()` alongside the hook. No forced "always at least one tab." |
| `useJsonFileSystem.js` | The lazy-loaded folder tree (children fetched only on expand) plus the scratches list, backed by `api/jsonLensClient.js` |
| `useJsonSidebar.js` | JSON Lens's own sidebar open/width state — deliberately separate from Log Lens's `useFieldsSidebar.js`, not a shared namespaced hook; see `docs/ROADMAP.md` |

## `api/`

- **`jsonLensClient.js`** — fetch wrappers matching every JSON Lens server route (`jsonLens/routes.js`).
