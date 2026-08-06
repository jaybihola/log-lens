# logLens/

Log Lens's own components/hooks/filter/render/api — nothing outside this
directory (other than `shared/`, `shell/`, or the top-level `App.jsx`)
imports from here, and this directory should never import from
`jsonLens/`. See `docs/ARCHITECTURE.md` for the deeper narrative
(`EntryView`'s virtualization, the tailing/SSE model, etc.) — this file is
just a map.

## `components/`

| File | What |
|---|---|
| `TabBar.jsx` | The tab strip — status dot, rename-free (label derives from file path/query), context menu |
| `TabPickerModal.jsx` | The "+" modal — switches between `FilePickerBody` and `RemoteQueryBody` |
| `Toolbar.jsx` | Filter box + mode toggle + the popover menus (view options, presets, more) |
| `FilterInput.jsx` | The text-mode JQL box, with field-name autocomplete for remote-query tabs |
| `VisualFilterBuilder.jsx` | The pill-based visual filter builder — reads/writes the same query string as `FilterInput` |
| `FilterClauseEditor.jsx` | Add/edit form for one visual-filter pill (field, operator, value(s), AND/OR placement) |
| `TimeHistogram.jsx` | Collapsible, display-only log-volume-over-time strip — buckets the currently filtered/on-screen buffer by `render/timestamp.js`'s `ownTimestamp`; no drag-select/click-to-filter, toggled from Toolbar's view-options menu |
| `EntryView.jsx` | The virtualized log line list — owns find-in-view state and the shared context-menu instance |
| `LineRow.jsx` | One log line — highlighting, pin/expand/context-menu, the hover action bar |
| `ExpandedDoc.jsx` | A line's "Show more" panel — Table (`FieldTable`) / JSON (`CodeViewer`) tabs |
| `FieldTable.jsx` | Flattened field→value rows (wraps `render/fieldTable.js`), with per-row "+ Column" toggles |
| `CodeViewer.jsx` | Read-only line-numbered/foldable raw-JSON-or-XML view of one entry |
| `FieldStatsPopover.jsx` | Hover value-distribution card for a field, computed from the tab's own buffer |
| `FieldsSidebar.jsx` | The Kibana-style available-fields tree (built on `shared/components/FieldTree.jsx`) |
| `LogHeader.jsx` | The column header row — resize handles, remove-column, right-click |
| `FindBar.jsx` | The find-in-view bar (highlights without removing lines) |
| `MoreMenu.jsx` | Popover: pinned lines list, jump-to-line, this tab's extra columns |
| `PresetsMenu.jsx` | Popover: saved filter presets, save-current-as-preset |
| `RemoteQueryBody.jsx` | The remote-query tab creation form — environment/index/date-range/KQL/fold-filters/raw-request-override |
| `FoldFilterChips.jsx` | One fold filter's chip input, autocompleting against the backend's distinct values |
| `HelpPanel.jsx` | The `?` popover — JQL syntax table + keyboard shortcuts |
| `preferences/*` | The Preferences modal and its panes (Environments, Credentials, Appearance, About) — a Log Lens-only feature, JSON Lens has no settings surface |

## `hooks/`

| File | What |
|---|---|
| `useTabs.js` | The big one: tab metadata (server-synced via `/api/tabs`) plus, per tab, a `ref`-held mutable line buffer (not React state — a fast-tailing background tab shouldn't force a re-render) and UI state (filter query, autoscroll, pause, expanded/pinned sets, extra columns). Renders batch to once per animation frame. Subscribes to `useLiveEvents` and reconciles a server restart (changed boot id) by reloading everything from scratch. |
| `useLiveEvents.js` | Opens the shared `/api/events` SSE connection, dispatches `onLine`/`onStatus`/`onBootChanged` |
| `useIndexFields.js` | An index's cached field name/type list — backs JQL field-name autocomplete and Preferences' path autocomplete |
| `useFieldsSidebar.js` | The fields sidebar's open/width state, localStorage |
| `useFilterMode.js` | Text vs. visual filter-box mode, localStorage — both read/write the same `filterQuery` string |
| `usePresets.js` | Named, saved JQL queries, localStorage |
| `useRecentFiles.js` | Last 8 opened file paths, localStorage |
| `useColumnWidths.js` | Drag-resized timestamp/level/extra-column widths, localStorage |
| `useDisplaySettings.js` | The log view's font size and the time histogram's open/closed state, localStorage |

## `filter/` — the JQL grammar (full reference: `docs/JQL.md`)

`simpleJql.js` (tokenizer/parser/matcher) → `compile.js` (wraps it into the `{ matcher, terms,
error }` shape the rest of the app consumes, fail-open on a parse error) → `visualClauses.js`
(the pill builder's text ⇄ structured-clauses bridge, DNF groups).

## `render/` — pure logic, no React

| File | What |
|---|---|
| `jsonPaths.js` | Extracts a JSON object from an arbitrary log line, dot-path lookups distinguishing "absent" from "present but null" |
| `highlight.js` | Regex-based JSON/XML/plain-text inline syntax highlighting for the compact log view |
| `fieldTable.js` | Flattens a JSON entry into dot/bracket-path rows for the "Show more" field table |
| `fieldStats.js` | A field's value distribution, computed from what's already buffered client-side |
| `pairing.js` | Console/JSON log-pair detection — **built but not currently wired up**, see `docs/ROADMAP.md` |
| `timestamp.js` | Timestamp extraction/formatting, jump-to-line/time resolution |
| `timeHistogram.js` | Buckets a set of entries by `timestamp.js`'s `ownTimestamp` into equal-width time slices for `components/TimeHistogram.jsx`'s density strip; entries with no resolvable timestamp are excluded but counted separately |

## `api/`

- **`client.js`** — fetch wrappers matching every Log Lens server route (`logLens/routes/*.js`).
