# shared/

Reusable building blocks used by (or architecturally meant for) more than
one tool — no Log-Lens- or JSON-Lens-specific logic anywhere in here. See
`docs/ARCHITECTURE.md`'s "Changing something in `shared/`" section before
editing anything below: additive-only changes, and check the *other* tool's
usage before moving on, not just the one that motivated the change.

## `components/`

| File | What |
|---|---|
| `FieldTree.jsx` | Collapsible nested-folder tree — `items`+`getPath` (eager) or `nodes` (caller-managed, lazy-loading-friendly) |
| `Dropdown.jsx` | Custom `<select>` replacement — button trigger + a portaled, keyboard-navigable listbox panel. The app has no native `<select>` anywhere; every "pick one of these" control (bucket interval, environment/index pickers, field-type overrides, JQL operator/group pickers, indent size, credential picker, auto-refresh interval) goes through this instead |
| `ContextMenu.jsx` | Cursor-anchored right-click menu, portaled to `document.body` |
| `Tooltip.jsx` | Custom hover tooltip (label + description) — not the native `title` attribute |
| `ConfirmModal.jsx` | Generic "are you sure" dialog with caller-supplied action buttons |
| `PromptModal.jsx` | Generic single-text-input dialog |
| `Popover.jsx` | Lightweight anchored dropdown (not a centered modal) — view-option menus, quick lists |
| `FilePickerBody.jsx` | Directory-browsing UI; `mode` picks open-file / choose-folder / save-file. Opt-in `multiple` (default off) adds per-file checkboxes + an "Open N selected" action in open-file mode, calling `onOpenMultiple(paths)` — Log Lens's file picker turns it on, JSON Lens's single-file callers are untouched |
| `EmptyState.jsx` | The "nothing open" full-pane screen (icon, title, actions, optional quick list) |
| `JsonEditor.jsx` | The CodeMirror 6 wrapper — full-document JSON/XML/text editing, JSON lint |
| `CopyButton.jsx` | A button that copies text and flashes "Copied!" |
| `SidebarResizeHandle.jsx` | Drag handle on a sidebar's edge |
| `ColumnResizeHandle.jsx` | Drag handle on a table/header column's edge (currently only Log Lens actually renders one, but the component itself has zero Log-Lens-specific logic) |

## `hooks/`

- **`useContextMenu.js`** — right-click menu state for a `ContextMenu.jsx`. `openMenu(e, items,
  activeId?)` / `isMenuActive(id)` lets a list keep the row that opened the menu looking active
  while it's open — see `docs/ARCHITECTURE.md`'s reusable-component-library section for why.

## `render/`

- **`fieldTree.js`** — turns a flat list of dot-path items into a nested tree
  (`buildFieldTree`/`buildFlatList`/`filterFieldTree`/`collectFolderPaths`). Shared by Log Lens's
  `FieldsSidebar` (via the `items`+`getPath` contract) and JSON Lens's folder tree (which instead
  hands `FieldTree.jsx` a pre-built `nodes` tree directly, since a real filesystem can't be
  eagerly recursed into the way a bounded field list can — see `docs/ARCHITECTURE.md`).

## `api/`

- **`http.js`** — the three fetch primitives (`request`/`jsonPost`/`jsonPut`) both tools' own
  `api/` modules (`logLens/api/client.js`, `jsonLens/api/jsonLensClient.js`) build on.
