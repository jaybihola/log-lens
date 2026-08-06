# jsonLens/

JSON Lens's own components/hooks/api — nothing outside this directory
(other than `shared/`, `shell/`, or the top-level `App.jsx`) imports from
here, and this directory should never import from `logLens/`. See
`docs/ARCHITECTURE.md` for the deeper narrative (the tab origin model,
save/scratch/discard flow, the filesystem hook) — this file is just a map.

## Top level

| File | What |
|---|---|
| `JsonFormatterApp.jsx` | The tool's entire top-level component — tabs, toolbar, Edit/View mode toggle, field-filter, editor, and the save/close-tab decision-modal state machine |
| `jsonUtils.js` | Pure logic: JSON validation/error-location, format/minify/sort-keys, fuzzy field search, field-filter pruning, escape/unescape, table-view helpers (value typing/preview/parsing) |
| `JsonLens.css` | This tool's own styling |

## `components/`

| File | What |
|---|---|
| `JsonFileSidebar.jsx` | Folder tree + scratches list, built on `shared/components/FieldTree.jsx` |
| `JsonTabBar.jsx` | JSON Lens's tab strip — dirty dot, rename, same context-menu-stays-active pattern as Log Lens's `TabBar` |
| `JsonTableView.jsx` | View mode's tabular sub-mode — key/type/value rows, nested objects/arrays expand in place (each row owns its own expand state, no path-keyed Set to maintain) |

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

## `hooks/`

| File | What |
|---|---|
| `useJsonTabs.js` | Tabs: almost entirely localStorage (a JSON Lens "tab" is just an editor buffer, no server tab registry to sync). Tracks `origin` (`"new"`/`"file"`/`"scratch"`), `content` vs. `savedContent` for dirty-checking, exports `isTabDirty()` alongside the hook. No forced "always at least one tab." |
| `useJsonFileSystem.js` | The lazy-loaded folder tree (children fetched only on expand) plus the scratches list, backed by `api/jsonLensClient.js` |
| `useJsonSidebar.js` | JSON Lens's own sidebar open/width state — deliberately separate from Log Lens's `useFieldsSidebar.js`, not a shared namespaced hook; see `docs/ROADMAP.md` |

## `api/`

- **`jsonLensClient.js`** — fetch wrappers matching every JSON Lens server route (`jsonLens/routes.js`).
