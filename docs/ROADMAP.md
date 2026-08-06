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
