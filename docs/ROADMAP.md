# log-lens — Roadmap

Tracks what's built vs. planned. Log Lens's full behavior spec, from the earlier single-file
prototype this app replaced, lives at
[`local/references/log-viewer/docs/ARCHITECTURE.md`](../local/references/log-viewer/docs/ARCHITECTURE.md)
(not tracked in git) — with a few deliberate deviations noted below. JSON Lens and HTTP Lens have
no such prior spec; they're native to this codebase.

## Done — infrastructure

- **`shared`/`logLens`/`jsonLens` directory split** (both `server/src/` and `client/src/`), plus
  `App.css` split into `App.css` (shell + shared) + `logLens/LogLens.css` + `jsonLens/JsonLens.css`
  — done specifically to let the two tools be worked on in parallel (by separate people or
  separate agents) with minimal shared-file collisions. See `docs/ARCHITECTURE.md`'s "Directory
  structure" section for the full rationale and the protocol for changing anything in `shared/`.

## Done — Log Lens

- Fastify backend: tab registry, file tailing (poll + truncation detection + continuation-line
  joining for stack traces), SSE broadcast, ring buffer + history endpoint, directory-browsing
  file picker API, state persistence (`~/.log-lens-state.json`).
- React frontend: tab bar, file picker, live SSE-driven log view (virtualized — only visible rows
  are real DOM nodes), autoscroll/pause/clear, nodemon-backed dev workflow (`./start.sh`).
- JQL filter: AND/OR/NOT, quoted phrases, `field:value` / `field:*` (presence) / `field:null`
  (explicit null, distinct from absence) / `field:(a,b,c)` (IN-list) / `*` wildcards, parenthesized
  grouping, case-sensitivity toggle. A visual pill-based builder (AND-within-group,
  OR-between-groups) reads/writes the same query string as the text box, falling back to one
  "advanced" pill for anything it can't cleanly decompose.
- A separate always-non-destructive **find-in-view** bar, distinct from the filter box (which
  removes non-matching lines) — highlights and steps through matches without touching what's
  currently shown.
- JSON/XML/plain-text syntax highlighting, log-level detection + color coding, long-line
  truncation, boot-id-based reconnect handling (survives a backend restart).
- Expandable line detail — "Show more" opens a flattened field table (dot/bracket paths) and a
  line-numbered/foldable raw code viewer.
- Extra columns — user-defined JSON dot-paths shown as their own column, toggled from the field
  table or the reusable field-tree sidebar; a column pointed at a whole object/array (a "folder")
  gets JSON-syntax-highlighted in place, not just dumped as a raw string.
- Remote Elasticsearch/OpenSearch query tabs — config-driven environments/indices/fold filters
  (`server/log-lens.settings.json`, git-ignored — see `.example.json`), server-side credential
  handling (Preferences-modal-saved > `.env` > process env), a KQL-ish query builder, quick date
  ranges, fold-filter chip inputs with live autocomplete, dedup-on-refetch, and a
  `mock-es-server.js` test double.
- Saved filter presets — name/reapply/delete a filter query, persisted per-browser.
- Highlight-only mode — show every buffered line, dim non-matches instead of hiding them.
- Pinned lines (own background, listed in the "More" menu for quick jump-back regardless of the
  current filter), a Kibana-style field-tree sidebar (collapsible nested folders, flat-list
  toggle, hover value-distribution popover), and context menus (right-click) on lines/tabs/fields/
  presets/pinned lines/column headers.
- **Send to JSON Lens** — a line's context menu can hand its (pretty-printed, if parseable)
  content straight to a new JSON Lens tab.
- **Time histogram** — a collapsible bar strip (Toolbar's view-options menu toggles it, visible by
  default for a first-time user while still respecting anyone who'd already toggled it off)
  showing log volume over time, bucketed from `ownTimestamp` on whatever's currently
  filtered/on-screen (not the raw buffer), so a burst of activity is visible at a glance. Live-
  updating with streamed lines and filter changes, freezes in step with the tab's own Pause, and
  makes its buffered-lines-only scope explicit rather than implying full-file coverage. Now
  Kibana-Discover-flavored:
  - Each bucket is **stacked by log level** (error/warn/info/debug, `highlight.js`'s `levelClass`,
    the same `--error`/`--warn`/`--info`/`--debug` tokens used everywhere else), not just a plain
    volume bar.
  - **Adjustable bucket interval** — Auto (span-based, snapped to a "nice" interval the same way
    Kibana's own default does) or a manual override from a small dropdown (1s through 1d).
  - **Drag-to-select a time range** (or click a single bar) narrows the tab's view to that window.
    Implemented as a second, independent filtering axis in `filter/compile.js` — a `timeRange`
    ANDed onto the JQL match rather than injected into the query string — so it composes with
    whatever's already typed in the filter box instead of replacing it, and has its own reset
    control (in the histogram's header and as a chip in the log view's info bar) distinct from
    clearing the JQL query. The histogram's own bars keep charting the full JQL-filtered picture
    regardless of an active time-range selection, so adjusting/replacing it stays easy.
- **Copy/export filtered lines** — the "More" menu's new Export section copies (clipboard) or
  downloads (`.txt` blob) exactly the currently filtered/on-screen lines — same
  `compileQuery`/pause-freeze computation as the time histogram, so it's always what you're
  actually looking at, not the raw unfiltered buffer.
- **Background-tab attention signal** — an error/warn-level line arriving on a Log Lens tab you're
  not currently looking at badges that tab in the tab bar and flashes `document.title` until you
  activate it; resets the moment you do, no persistence.
- **Silence/stalled-tailing indicator** — a soft, dismissable "quiet Xm" label appears on a tab
  that's still `watching` but hasn't produced a new line in a few minutes, derived from SSE
  line-arrival timestamps; never shown for `missing`/`error`/`idle`/`waiting` tabs, and
  automatically re-arms after the next line if dismissed.
- **Multi-select file open** — the file picker (`shared/components/FilePickerBody.jsx`) gained an
  opt-in `multiple` prop (Log Lens only — JSON Lens's single-file callers are unaffected): checkbox
  each file you want, then open them all as separate tabs in one action instead of one
  round-trip per file.
- **Saved tab groups** — name and persist the current set of open file tabs (`useTabGroups.js`,
  same localStorage-backed pattern as saved filter presets) and reopen the whole group in one
  click from the new header "Tab groups" menu — handy for a docker-compose stack's several log
  files.
- **Per-line outlier time-gap flag** — `EntryView` flags a line whose gap since the previous
  *visible* (filtered) line is a statistical outlier (a fixed floor combined with a multiple of the
  view's own median gap) with a small inline "+Xm Ys" chip. Deliberately not annotating every
  line — the time histogram already covers coarse-grained "where are the gaps"; this only adds the
  complementary signal of "how much did the current filter just skip over, between these two
  specific lines," and only when it's unusual enough to be worth a glance.

## Done — JSON Lens

- A real filesystem: open N folders at once, browsed as a lazy-loaded tree (children fetched only
  on expand — unlike Log Lens's field tree, a real directory tree can't be eagerly loaded whole).
  Open/edit/save any `.json` file back to disk; new file / rename / delete / refresh via context
  menus on folders and files.
- Tabs bound to one of three origins: a brand-new unsaved draft (autosaved to localStorage only),
  a real file on disk, or an app-managed **scratch** (a real file server-side under
  `~/.log-lens-scratches/`, listed in the sidebar, but never a file the user picked or sees among
  their own folders). Dirty-tracking and a close-tab flow that prompts to save/save-as-scratch/
  discard rather than ever silently losing content.
- Full CodeMirror editor: undo/redo, find/replace, fold all/unfold all, go-to-line, zoom
  (persisted font size), inline lint diagnostics (JSON parse errors anchored at the exact bad
  token, plus duplicate-object-key warnings computed from the real syntax tree).
- **Edit / View mode** — an explicit per-tab mode boundary (not just a side effect of field
  selection): Edit is the full toolbar and a freely editable document with no field-filter UI in
  the way; View is read-only with a decluttered toolbar (Copy/Download/Wrap/Fold/Zoom/Find/Go to
  line only) and is where field-filtering becomes available. View has two sub-modes — **Code**
  (the same read-only CodeMirror rendering) and **Table** (`components/JsonTableView.jsx`, a real
  key/type/value table with nested objects/arrays expandable in place, not just highlighted text).
- **Find-in-view** (`components/JsonFindBar.jsx`) — View mode only, same non-destructive
  highlight-and-step shape as Log Lens's own find bar (query, `n/total`, next/prev,
  case-sensitivity toggle, Cmd/Ctrl+F), explicitly kept separate from field-filtering: find only
  highlights plain-substring matches in whatever's currently displayed and steps through them,
  field-filter actually prunes what's shown. Works in both View sub-modes — Code sub-mode
  highlights matches as CodeMirror mark decorations and scrolls to the active one (an additive
  `highlightRanges`/`activeHighlightRange` prop pair on the shared `JsonEditor.jsx`, opt-in for
  every other caller); Table sub-mode highlights matching key/value cells, auto-expands just the
  active match's ancestor rows so it's never hidden inside a collapsed row, and scrolls the active
  row into view.
- Field-filtering: fuzzy-search a field name, disambiguate via a picker when it's ambiguous, view
  just the selected fields (read-only, View mode only) with the rest pruned but ancestor paths kept
  for context.
- Format / Minify / Sort keys / Escape (wrap as a JSON string literal) / Unescape / indent
  selection / wrap toggle / copy / download / import-from-disk (native file input) / clear.
- No forced "must always have a tab open" — closing the last tab (or starting fresh) shows a
  proper empty-state screen (new draft / open file / add folder / reopen a scratch), matching Log
  Lens's own upgraded empty state (open file / remote query / recent files list).

## Planned

- **Wire up console/JSON pairing** — `client/src/logLens/render/pairing.js`'s `computePairs`/`pairColor`
  (visually linking a structured JSON log entry with its traditional leveled console twin) and the
  `pairedSeq`/`onJumpToPaired` props already threaded through `LineRow`/`ExpandedDoc`/`FieldTable`
  exist and are ready to receive data, but nothing currently calls `computePairs` or passes those
  props from `EntryView`/`LogViewerApp` — the feature is built but disconnected, not active in the
  running app. (Originally tracked below as "deliberately out of scope"; corrected here after
  actually checking the wiring rather than assuming the module's existence meant it was live.)
- **HTTP Lens** — a third tool, a Postman-style HTTP client: method/URL/params/headers/body
  request editor, a status/timing/headers/body response viewer, and collections (one level of
  folders, each holding saved requests) persisted server-side the same way JSON Lens's
  scratches are. Requests are sent from the server, not the browser, to sidestep CORS the way
  remote query tabs already do for Elasticsearch. Scoped and prototyped once already; shelved
  mid-build pending a decision to resume — nothing about it currently exists in the tree.
- JQL field-name autocomplete in the filter box, sourced from the same cached index-fields list
  that already backs Preferences › Environments' path autocomplete.
- Electron shell wrapping the same client build, for a native desktop app.
- Splitting `server/src/logLens/state.js`'s single monolithic persisted blob (and
  `client/src/logLens/hooks/useFieldsSidebar.js`'s non-namespaced storage keys) into the same
  per-feature, immediate-persist-on-mutate pattern JSON Lens's own store already uses — noted as a
  deliberate "fix it in the new tool, don't touch the old one's behavior" deferral while JSON Lens
  was being built, not yet circled back to.

## Deliberately out of scope (for now)

The Log Lens prototype has these; we've decided not to port them until there's a concrete need:

- **`only:<path>` JQL projection** — collapsing a matching line down to just one field's value.
  Removed from the simple dialect; will get a different design later rather than being ported
  as-is.
- **Structured SQL-like JQL dialect** (`SELECT ... WHERE ...`) — sticking to the simple dialect
  only.
- **Console/JSON pairing heuristic** — visually linking a structured JSON entry with its
  traditional leveled console twin. The matching logic was actually written
  (`client/src/logLens/render/pairing.js`) and downstream display code exists, but it was never wired up
  to run — see "Wire up console/JSON pairing" under Planned above.
