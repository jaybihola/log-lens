# Architecture

How log-lens is actually built — for anyone extending it. See the root
[`README.md`](../README.md) for what it does and how to run it, and
[`ROADMAP.md`](ROADMAP.md) for what's done vs. planned.

## Directory structure: shared / logLens / jsonLens / shell

Both `server/src/` and `client/src/` are split the same way, deliberately —
so two people (or two agents) can work on Log Lens and JSON Lens at the same
time with minimal shared-file collisions. For the operational playbook (how
many agents at once, worktree setup, merge order), see
[`PARALLEL_AGENTS.md`](PARALLEL_AGENTS.md).

```
server/src/
├── config.js, index.js    entry point + config, import from all three below
├── shared/                  fileBrowser.js — used by both tools' file pickers
├── logLens/                  everything Log Lens-only: tabs/, es/, routes/, settings.js, credentials.js, sse.js, state.js
└── jsonLens/                  everything JSON Lens-only: store.js, files.js, routes.js

client/src/
├── App.jsx, main.jsx, App.css, index.css   entry point + shell-only/shared CSS
├── shell/                   ModeSidebar.jsx, useAppMode.js, useTheme.js — the app shell itself, not a tool
├── shared/                   components/, hooks/, render/, api/ — reusable building blocks, no tool-specific logic
├── logLens/                   LogViewerApp.jsx + its own components/, hooks/, filter/, render/, api/, LogLens.css
└── jsonLens/                   JsonFormatterApp.jsx + its own components/, hooks/, api/, JsonLens.css
```

**A file belongs in `shared/` only if it's genuinely used by (or is
architecturally meant to be reused by) more than one tool** — check for a
second real caller before adding something there; if only one tool uses it,
it belongs in that tool's own directory even if the code looks generic.
Getting this right matters more than it might seem: `shared/` is the one
place where two otherwise-independent workstreams actually touch, so this is
where accidental coupling — one tool's change silently breaking the other's
usage — is possible everywhere else in the tree isn't.

CSS follows the same split: `App.css` (shell + genuinely shared component
styling), `logLens/LogLens.css`, `jsonLens/JsonLens.css`, all imported
together from `App.jsx` (no lazy-loading — matches the JS side's
"everything mounted, always" philosophy, and the class names between the two
tool stylesheets don't collide by design, so load order doesn't matter).

`index.css` holds the design tokens all three files build on: the color
system (`--bg`/`--panel*`/`--border*`/`--fg`/`--dim*`, semantic
`--accent`/`--error`/`--warn`/`--info`/`--debug` + `-rgb` pairs for
alpha-blended tints, `--syntax-*`, `--shadow`/`--overlay`), plus a spacing
scale (`--space-1` 4px through `--space-6` 32px, with a few named half-steps
— `--space-1-5`/`--space-2-5`/`--space-4-5` — for 6px/10px/18px, which were
themselves common enough in the existing layout to be worth keeping exactly
rather than rounding away) and a type scale (`--text-xs` 11px through
`--text-lg` 16px) collapsing what used to be close to a dozen ad hoc
font-size values, including odd ones like `10.5px`/`12.5px`. Not every
padding/margin/gap/font-size in the app maps cleanly onto these scales —
one-off values that don't round to a step without visibly shifting a layout
were deliberately left as literal pixels rather than forced onto the scale.

### Changing something in `shared/`

Because both tools depend on it, a change here needs more care than a
change inside either tool's own directory:

1. **Additive only.** A new optional prop with a default that reproduces the
   old behavior exactly — never change an existing signature or default.
   This is how `FieldTree` grew its `nodes` prop (an alternative to
   `items`/`getPath`), its `isFolder` override, and its
   `onFolderContextMenu`/`isFolderMenuActive` props: each is opt-in, and
   every existing caller kept working with zero changes.
2. **Check the other tool's usage, not just your own, before moving on.**
   This is the rule that would have caught a real bug from this session:
   `onFolderContextMenu` was added to `FieldTree` for JSON Lens's folder
   tree, but Log Lens's `FieldsSidebar` was never updated to pass it too —
   nothing broke, but Log Lens silently fell behind on a capability the
   shared component now had. After extending something in `shared/`, grep
   its other callers and either wire the new capability in there too, or
   leave a note explaining why not. Silent drift, not breakage, is the
   failure mode to design against — additive-only changes already prevent
   breakage.
3. **Land `shared/` changes as their own commit**, separate from whichever
   tool-specific feature motivated them, so they're small and reviewable on
   their own.
4. **If working in separate git worktrees, merge `shared/` changes back
   first**, ahead of the rest of that branch — don't let them sit and
   accumulate divergence with what the other tool's branch expects.

## The app shell

`client/src/App.jsx` is the entire multi-tool illusion: a thin icon rail
(`shell/ModeSidebar.jsx`) picks which tool is visible, but **every tool is
mounted at all times** — `shell/useAppMode.js` (localStorage-persisted) only
toggles a `display: contents` / `display: none` class (`.mode-pane` /
`.mode-pane.hidden` in `App.css`) on each tool's wrapper div. Nothing
unmounts when you switch away. This matters because each tool owns real,
expensive-to-rebuild state: Log Lens's tabs, buffers, and its SSE
connection; JSON Lens's open tabs and editor content. Losing that on every
switch would mean a full reload (a fresh `/api/tabs` fetch + history replay
per tab) every time.

Each tool's top-level component takes an `active` boolean prop (true only
when it's the currently-visible one) purely to gate global side effects —
keyboard shortcut listeners, mostly — that would otherwise silently fire
against a tool you're not even looking at.

**Adding a fourth tool** means: a new `client/src/whateverLens/` directory
(mirroring `logLens/`/`jsonLens/`'s internal shape), a new top-level
`<WhateverApp active={...} />` component, a new entry in
`shell/ModeSidebar.jsx`'s `MODES` array, a new branch in
`shell/useAppMode.js`'s `MODES` list, a new
`<div className="mode-pane ...">` wrapper in `App.jsx`, and (on the server
side, if it needs one) a new `server/src/whateverLens/` directory the same
way. (HTTP Lens was built this way once already, then reverted — see
ROADMAP.md.)

### Cross-tool communication

Tools are otherwise fully independent — neither Log Lens nor JSON Lens
imports from the other (only from `shared/`, `shell/`, or their own
directory). The one exception is intentionally minimal: "send this log line
to JSON Lens" (Log Lens's line context menu). Rather than lifting either
tool's tab state up into `App.jsx`, `App.jsx` holds a single one-shot
`{ content, name, id }` request object, handed to `LogViewerApp` as an
`onSendToJsonLens` callback and to `JsonFormatterApp` as an `importRequest`
prop; `JsonFormatterApp` consumes it (creates a tab) and clears it via
`onImportHandled` the moment it's seen. If a future tool needs to hand data
to another one, follow this same shape — a narrow, one-shot prop at the
shell level — rather than merging their state.

## Server

Fastify (`server/src/index.js`), CORS-open (single-user local dev tool, not a
multi-tenant service), no auth of its own. Every feature area is a separate
route plugin registered in `index.js`:

| Route plugin | Feature area |
|---|---|
| `logLens/routes/tabs.js` | Log Lens tab lifecycle (create/open/close/activate/history/clear) |
| `logLens/routes/browse.js` | Directory listing — shared by both tools' file pickers |
| `logLens/routes/events.js` | The SSE endpoint (`/api/events`) |
| `logLens/routes/settings.js` | Remote-query environment config (get/save) |
| `logLens/routes/credentials.js` | Server-side-only ES credentials CRUD |
| `logLens/routes/esFields.js` | Index field list, fold-filter value autocomplete, raw-query preview |
| `jsonLens/routes.js` | JSON Lens: roots, browsing, file read/write/rename/delete, scratches CRUD |

### Log Lens: tabs, tailing, SSE

`logLens/tabs/registry.js` is the single in-memory source of truth
(`Map<id, tab>`) — no database, no per-tab child process. A tab is either
`kind: 'file'` (tailed) or `kind: 'api'` (remote-query, fetched on demand,
never tailed). Every mutating registry function ends by calling
`persistTabs()`, which snapshots the *entire* app state (open tabs,
credentials, settings) into one blob and writes it via `logLens/state.js` to
`~/.log-lens-state.json` — see "Persistence philosophy" below for why this
is called out as something to eventually improve rather than copy.

**Tailing** (`logLens/tabs/tailing.js`) is a plain `setInterval` poll
(default 300ms, `LOG_LENS_POLL_MS`), not `fs.watch` — deliberately, since
`fs.watch`'s behavior is notoriously inconsistent across
platforms/editors/network filesystems, and a log file is being *appended
to*, not renamed/moved, so polling `fs.stat().size` is both simpler and
reliable everywhere. Each poll: detects truncation (`size < lastSize` — a
fresh run overwrote the file, so the whole read state resets), reads only
the new byte range (`fs.createReadStream({ start, end })`, not the whole
file), and splits it into lines. An indented physical line is treated as a
*continuation* of the previous message (`CONTINUATION_RE = /^[ \t]/`) and
joined back with real newlines rather than becoming its own entry — this is
what keeps a .NET-style stack trace as one log line instead of dozens. The
last message in a batch has no following message to trigger its own flush,
so a short debounce timer (400ms) flushes it on its own after a quiet
period.

**SSE** (`logLens/sse.js`) is a flat `Set` of open `reply` objects, broadcast
to on every pushed line/status change — no per-client filtering server-side
(the client already has the full buffer and filters locally). A `BOOT_ID`
(`crypto.randomUUID()`, regenerated every process start) is sent as the
first event; the client compares it across reconnects to tell "the dev
server restarted" apart from "the network blipped" and reloads tabs from
scratch only in the former case (see `logLens/hooks/useLiveEvents.js`).

**Remote query tabs** never tail; `fetchApiTab()` runs one search
(`logLens/es/fieldCache.js`'s `runEsSearch`) and pushes only documents not
already seen for that tab (`tab.seenIds`, an in-memory `Set` — reset
whenever the query itself changes, via `configureApiTab`), so re-fetching
after widening a date range is safe to call repeatedly.
`logLens/es/queryBuilder.js` has its own small hand-rolled KQL-ish parser
(tokenize → recursive-descent AST → Elasticsearch bool query) — unrelated
to, and much simpler than, the client-side JQL parser
(`client/src/logLens/filter/simpleJql.js`); don't confuse the two, they
solve different problems (querying a remote index vs. filtering an
already-fetched buffer). `logLens/es/fieldCache.js` also caches each fold
filter's distinct values (a terms aggregation, process-lifetime only — this
is a dev tool restarted often enough that staleness isn't worth solving).

Each index's field name+type list is deliberately **not** fetched from
`_mapping` — a dedicated mapping request is a real, unbounded, cluster-taxing
metadata operation (some production indices run 80k+ fields, or index
*patterns* fanning out to many concrete indices), and firing one just because
a tab became active or a Preferences pane was opened isn't a risk this tool
takes, no exceptions and no opt-out setting. Instead, `runEsSearch` flattens
every real hit's `_source` into dot-path fields (same shape as the old
mapping-flattening, walking real values instead) and merges newly-seen field
names into that environment+index's accumulated cache — nothing is ever
indexed unless a user actually ran that query. The type label is inferred
from the JS value (`typeof`/`Array.isArray`/`null`), which is necessarily
less precise than ES's own mapping types (can't distinguish `keyword` from
`text`, or `long`/`integer`/`float`, and dates read as plain strings) — an
accepted trade-off for never issuing a dedicated indexing request. The cache
persists to `~/.log-lens-fields-state.json` (`config.js`'s
`INDEX_FIELDS_STATE_FILE`, same `fs.readFileSync`/`writeFileSync` pattern as
`logLens/state.js`) and only ever grows, surviving restarts — an in-memory-only
cache would drain to empty every dev-server restart, defeating the point.
`fetchIndexFields` (and the `GET /api/index-fields` route) are pure reads of
this accumulated cache; an index nobody's queried yet just returns an empty
list, not an error — the field list fills in as the app gets used, not
upfront.

**Credentials** (`logLens/credentials.js`) are named Basic Auth pairs, held
server-side only and never sent to the browser (the list endpoint redacts
passwords) — an environment picks one by id (`logLens/settings.js`'s
`credentialId`). Resolution order on first boot: `.env`'s `ES_USERNAME`/
`ES_PASSWORD` seeds one credential, but only until anything is ever saved
through the UI — after that, the state file is authoritative, including an
intentionally-emptied list.

### JSON Lens: filesystem + scratches

Deliberately **not** built on top of `logLens/tabs/registry.js` — a saved
JSON document needs read/write, not tailing/polling/SSE, so reusing the tab
registry's machinery would mean carrying a pile of irrelevant fields
(`buffer`, `seq`, `pollTimer`, …) for no benefit. Instead:

- `jsonLens/files.js` — thin wrappers around `fs/promises` (read/write/
  rename/delete/exists) for arbitrary paths the user has opened via the
  folder tree.
- `jsonLens/store.js` — open root folder paths + scratch metadata
  (id/name/updated-at), its **own** state file
  (`~/.log-lens-json-state.json`), persisted immediately inside every
  mutating function rather than via a separate step the caller has to
  remember to call (contrast with `persistTabs()` above — this is the
  improvement described in "Persistence philosophy" below, applied here
  first rather than retrofitted onto Log Lens).
- Scratch **contents** live as real files under `~/.log-lens-scratches/`,
  one per scratch, named by id — real files on disk, just never ones the
  user picked or sees in their own folder tree.
- `jsonLens/routes.js` exposes: root folders (list/add/remove), a
  `.json`-filtered directory browse (reusing `shared/fileBrowser.js`'s
  `browseDirectory`, extended with an optional extension filter that leaves
  Log Lens's own `/api/browse` call unaffected since it never passes one),
  file read/write/rename/delete/exists, and scratches CRUD.

### Persistence philosophy

Two patterns exist side by side, deliberately not unified yet:

- **Log Lens** (`logLens/state.js` + `logLens/tabs/registry.js`): one
  mutable in-memory blob, written wholesale to one file by `persistTabs()`,
  which every mutating route/function must remember to call. Simple, but
  fragile — miss a call and a change silently doesn't survive a restart.
- **JSON Lens** (`jsonLens/store.js`): its own dedicated file, and every
  exported mutator persists itself inline, immediately — there's no separate
  "don't forget to save" step to get wrong.

JSON Lens intentionally did **not** copy Log Lens's pattern; ROADMAP.md
tracks retrofitting Log Lens onto the same approach as a deferred cleanup, not
yet done.

## Client

React 19 + Vite. `client/src/App.jsx` is the shell described above. Every
other file lives in `shared/`, `shell/`, `logLens/`, or `jsonLens/` (see
"Directory structure" at the top) — within `logLens/` and `jsonLens/`, both
tools use the same internal shape:

```
<tool>/
├── <ToolApp>.jsx      top-level component
├── components/          UI
├── hooks/                 state
├── api/                    fetch wrappers for that tool's own routes
├── render/                 pure display-logic helpers (Log Lens only — JSON Lens's equivalent is just jsonUtils.js)
├── filter/                 Log Lens only — JQL, no JSON Lens equivalent
└── <Tool>.css              that tool's own styling
```

### `shared/api/http.js` + each tool's own `api/`

`shared/api/http.js` has the three fetch primitives (`request`/`jsonPost`/
`jsonPut`) every other API module builds on. `logLens/api/client.js` and
`jsonLens/api/jsonLensClient.js` are otherwise **fully independent
modules** — neither imports the other, each just exports a flat object of
named functions matching its tool's own route plugin.

### `logLens/filter/` — JQL (no JSON Lens equivalent)

`filter/simpleJql.js` is the whole grammar in one file: a regex-based
`tokenize()`, a recursive-descent `parseSimpleAst()` (OR lowest precedence,
implicit AND between adjacent atoms, parens for grouping), and
`evalSimpleAst()` which runs the resulting AST against one line's raw text +
`render/jsonPaths.js` for `field:` lookups. `filter/compile.js` wraps that
into the `{ matcher, terms, error }` shape the rest of the app consumes — a
malformed query never hides the buffer; it falls back to "match everything"
with the parse error surfaced separately, so a typo never looks like "all my
logs disappeared." `filter/visualClauses.js` is the bridge to the pill-based
visual builder: it doesn't maintain separate state, it decomposes/recomposes
the *same* query string the text box uses, falling back to one opaque
"advanced" pill the moment a query doesn't cleanly fit the
groups-of-AND'd-field-clauses-ORed-together shape it understands. See
[`docs/JQL.md`](JQL.md) for the full language reference.

### `logLens/render/` + `shared/render/fieldTree.js` — pure logic, no React

Every file here is framework-free and (mostly) side-effect-free — safe to
unit-test directly, and reused by anything that needs the same computation
without needing to *be* a component:

| File | What |
|---|---|
| `logLens/render/jsonPaths.js` | Extracts a JSON object from an arbitrary log line (whole text → each physical line → first embedded `{...}`), dot-path lookups distinguishing "absent" from "present but null" |
| `logLens/render/highlight.js` | Regex-based JSON/XML/plain-text inline syntax highlighting (the compact log view's own highlighter — CodeMirror is used for full-document editors instead, see below) |
| `logLens/render/fieldTable.js` | Flattens a JSON entry into dot/bracket-path rows for the "Show more" field table |
| `logLens/render/fieldStats.js` | A field's value distribution, computed only from what's already buffered client-side (never a fresh query) |
| `logLens/render/pairing.js` | Console/JSON log-pair detection — **built but not currently wired up**, see ROADMAP.md |
| `logLens/render/timestamp.js` | Timestamp extraction/formatting, jump-to-line/time resolution |
| `shared/render/fieldTree.js` | Turns a flat list of dot-path items into a nested tree — shared by Log Lens's fields sidebar and (via a second, lazy-loading-friendly contract) JSON Lens's folder tree, see below |

### `hooks/` — state

No global store (Redux/Zustand/etc.) — state is local to whichever hook
owns it, composed by each tool's top-level component. Two families:

- **localStorage-persisted UI preferences**, all following the same
  load-on-init/save-on-change shape: `shell/useTheme.js`,
  `logLens/hooks/useDisplaySettings.js`, `useColumnWidths.js`,
  `useFilterMode.js`, `useRecentFiles.js`, `usePresets.js`,
  `useFieldsSidebar.js` / `jsonLens/hooks/useJsonSidebar.js` (deliberately
  **not** unified behind one namespaced hook — see ROADMAP.md),
  `shell/useAppMode.js`.
- **Server-synced state**: `logLens/hooks/useTabs.js` (wraps `/api/tabs` +
  `useLiveEvents`'s SSE subscription, the single biggest hook in the app),
  `jsonLens/hooks/useJsonTabs.js` (almost entirely localStorage, no server
  tab registry to sync since a JSON Lens "tab" is just an editor buffer;
  its `isTabDirty` dirty-checking export lives alongside it, not shared),
  `jsonLens/hooks/useJsonFileSystem.js` (the lazy folder tree + scratches
  list, backed by `api/jsonLensClient.js`), `logLens/hooks/useIndexFields.js`,
  `shared/hooks/useContextMenu.js` (generic — see below).

### Reusable component library (`shared/components/`)

These have no tool-specific knowledge baked in and are used by both Log Lens
and JSON Lens (or are ready to be, by any future tool):

- **`FieldTree.jsx`** — a collapsible nested-folder tree. Two ways to feed
  it data: `items` + `getPath` (the original contract — the whole set is
  known upfront and small, e.g. index field names, so it's fine to eagerly
  build the full nested structure every render) or `nodes` (a pre-built tree
  handed in directly, for a caller managing its own lazy loading — JSON
  Lens's real filesystem can't be eagerly recursed into the way a bounded
  field list can). `node.isFolder`, when explicitly set, overrides the
  default "has children" heuristic, since a lazily-loaded directory can be
  genuinely empty and still be a folder. `onFolderContextMenu` fires for a
  right-click anywhere on a folder row (not just its trailing action
  button); `isFolderMenuActive` lets a caller keep a folder row visually
  "active" while its context menu is open.
- **`ContextMenu.jsx`** + **`useContextMenu.js`** — a right-click menu
  anchored at cursor coordinates, portaled to `document.body` (required:
  triggering it from inside a `transform`-positioned ancestor, like a
  virtualized list row, would otherwise break `position: fixed` — the
  transform becomes the containing block instead of the viewport). The hook
  also tracks *which* row opened the menu (`openMenu(e, items, activeId)` /
  `isMenuActive(id)`), so a list can keep that one row looking hovered
  (`menu-target` class) while suppressing real `:hover` on every other row
  via a `menu-open` class on the list's container — otherwise moving the
  cursor toward the (portaled, so no-longer-a-descendant) menu drops the
  triggering row out of `:hover` mid-interaction.
- **`Tooltip.jsx`** — custom (not the native `title` attribute), label +
  one-line description, `disabled` prop for suppressing it while some other
  popover triggered by the same element is already open.
- **`Dropdown.jsx`** — custom `<select>` replacement (the app has no native
  `<select>` anywhere): a button trigger + a portaled listbox panel, same
  portal-to-`document.body` rationale as `ContextMenu.jsx`. Full keyboard nav
  (arrows/Home/End/Enter/Escape/Tab), click-outside/scroll/resize close, and
  viewport clamping that flips the panel above the trigger when there isn't
  room below.
- **`ConfirmModal.jsx`** / **`PromptModal.jsx`** — the app has no native
  `window.confirm`/`window.prompt` anywhere; these are the generic
  replacements every "are you sure" / "name this" flow uses.
- **`FilePickerBody.jsx`** — directory-browsing UI with a `mode` prop
  (`'open-file'` default/Log Lens's original behavior, `'choose-folder'`,
  `'save-file'`) and an injectable `browseFn` (defaults to Log Lens's
  `/api/browse`; JSON Lens passes its own `.json`-filtered one) — so both
  tools' "pick something on disk" flows share one component.
- **`EmptyState.jsx`** — the "nothing open yet" full-pane screen (icon,
  title, action buttons, an optional quick-pick list) both tools' empty
  states are built from.
- Smaller ones: `CopyButton.jsx`, `Popover.jsx`, `SidebarResizeHandle.jsx`,
  `ColumnResizeHandle.jsx`.

### Full-document editing: `shared/components/JsonEditor.jsx`

One CodeMirror 6 wrapper (`@uiw/react-codemirror`) used by JSON Lens's main
editor, Log Lens's raw-request-body editor, and a line's expanded JSON code
viewer. `language` picks the CodeMirror language extension (`'json'`,
`'xml'`, or `'text'` — plain, no grammar, for content that was never JSON to
begin with). Theme colors are built from the same CSS custom properties
(`--panel-2`, `--syntax-*`, …) the rest of the app uses, so a JSON document
looks identical whether it's rendered inline (via
`logLens/render/highlight.js`'s regex highlighter) or open in this editor.
`language === 'json'` also enables a custom `@codemirror/lint` source: a
JSON parse error (from `jsonLens/jsonUtils.js`'s `locateJsonError`, which
extracts a real character offset from the engine's own error message)
underlines the exact bad token instead of just reporting "invalid JSON"
somewhere else on screen; a second pass walks the actual Lezer syntax tree
(not a regex) to flag duplicate keys within the same object, which
`JSON.parse` otherwise silently resolves by keeping the last one. A
`forwardRef` exposes undo/redo/find/foldAll/unfoldAll/gotoLine as imperative
methods, so a toolbar living outside the editor (JSON Lens's) can still
drive real CodeMirror commands against the live view.

### Log Lens's own structure (`logLens/`)

`LogViewerApp.jsx` → `components/EntryView.jsx` (the virtualized list —
`@tanstack/react-virtual`, so a multi-thousand-line buffer stays cheap; only
visible rows + overscan exist as real DOM nodes, each self-reporting its
real measured height since row height varies with wrapping/expansion) →
`components/LineRow.jsx` per visible row. `EntryView` owns one shared
`useContextMenu` instance for the whole list (not one per row — needed for
the menu-stays-active-while-open behavior described above) and the
find-in-view state (separate from the tab's own `filterQuery`, which
actually removes non-matching lines). `components/Toolbar.jsx` is the
filter box + mode toggle + all the popover menus (`PresetsMenu`, `MoreMenu`
— pinned lines / jump-to-line / columns); `components/FieldsSidebar.jsx` is
the Kibana-style field-tree panel described above.

### JSON Lens's own structure (`jsonLens/`)

`JsonFormatterApp.jsx` is the tool's top-level component — tabs, the
field-filter row, and the editor, plus the whole close-tab/save/save-as
decision-modal state machine (mirrors the shape of "unsaved changes, what do
you want to do" from any real editor). Everything else it needs is either
`shared/` or its own `useJsonTabs`/`useJsonFileSystem`/`useJsonSidebar`
hooks. `components/JsonFileSidebar.jsx` is the folder-tree + scratches
sidebar; `components/JsonTabBar.jsx` is its tab strip (dirty dot, rename,
the same context-menu-stays-active pattern *and* the same overflow-scroll
behavior — `canScrollLeft`/`canScrollRight`, a `ResizeObserver`, the
`.tab-scroll-btn` buttons — as Log Lens's `TabBar`); `components/
JsonToolbar.jsx` is the mode toggle/save/undo-redo/find/format/wrap/fold/
zoom/copy row, following the same "renders its own wrapper div, takes
values + callbacks as flat props" shape as Log Lens's `components/
Toolbar.jsx`. The Edit/View mode toggle is the one icon control in the app
that keeps a visible text label next to its icon instead of relying on
`Tooltip` alone — a deliberate, documented exception (see the comment above
`.json-mode-toggle` in `JsonLens.css`), not a drift from the tooltip-only
convention everything else follows.

## Verification workflow used while building this

Not automated tests (there are none yet) — the pattern used throughout this
codebase's development, worth continuing: after any edit, `curl` every
touched file from the Vite dev server (a genuine syntax error returns a
non-200 or the SPA fallback's `text/html` instead of real JS — check
content-type, not just status code, since Vite's dev server serves
`index.html` with a `200` for unmatched paths too), then a full recursive
sweep of every `client/src/**/*.{js,jsx,css}` the same way, then tail the
dev server's log and check for anything *after* the last edit's timestamp —
a benign, non-recurring error mid-multi-file-edit (stale Fast Refresh
reconciling an old module against new code) is common and self-resolves
once the whole edit batch settles; a *recurring* one after things settle is
a real bug. After any large-scale file move (like the `shared`/`logLens`/
`jsonLens` restructure itself), also do a clean restart of the Vite process
(`rm -rf client/node_modules/.vite`, kill the process, start it fresh) —
HMR alone doesn't reliably recover from many files moving at once.
