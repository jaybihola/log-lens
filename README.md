# log-lens

A small suite of local developer tools sharing one app shell and one Fastify backend:

- **Log Lens** — tails a log file and streams it to a browser, with a client-side filter language
  (JQL) that re-scans instantly as you type — no server round-trip. Built for grepping noisy local
  debug output (a server or test run redirected to a file, or a "save console output to file" run
  option) without scrolling a terminal. Can also query a remote Elasticsearch/OpenSearch-shaped
  search backend directly (see "Remote query tabs" below).
- **JSON Lens** — a JSON formatter/validator/editor with a real filesystem: open folders, edit and
  save `.json` files back to disk, or keep app-managed "scratch" documents that persist across
  restarts without ever being a file you picked. Field-filtering, inline lint diagnostics, and a
  full CodeMirror-backed editor (undo/redo, find/replace, fold, go-to-line, zoom).

Both tools stay mounted at all times behind a thin icon rail (`client/src/App.jsx`) — switching
between them hides one and shows the other via CSS rather than unmounting, so neither loses its
tabs/buffers/SSE connection when you're not looking at it. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how that (and everything else) actually works,
and [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's built vs. still planned (a third tool, HTTP
Lens — a Postman-style HTTP client — is scoped but not yet built).

Log Lens is a ground-up, better-organized rewrite of an earlier single-file prototype (kept for
reference under `local/references/log-viewer/`, not part of this app, not tracked in git).

## Stack

- **Backend** — Node + [Fastify](https://fastify.dev/), in `server/`. Tails files, holds a
  per-tab ring buffer, and pushes new lines to the browser over Server-Sent Events. Also proxies
  remote Elasticsearch/OpenSearch queries and serves JSON Lens's filesystem/scratch persistence —
  see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#server) for the full route map.
- **Frontend** — React + Vite, in `client/`. Log Lens's filtering/highlighting all happens
  client-side against the buffered lines — retyping a filter re-scans instantly with no network
  round trip. Full-document JSON views (JSON Lens's editor, a log line's "Show more" → JSON tab)
  use [CodeMirror 6](https://codemirror.net/) (`@uiw/react-codemirror`) for real syntax
  highlighting, folding, linting, and editing; the compact inline log view uses its own
  lightweight regex highlighter since it's rendering thousands of short lines, not one document.
- Two npm workspaces (`server`, `client`) under one root `package.json`.

## Quick start

```bash
./start.sh /path/to/app-debug.log
```

That installs dependencies on first run and starts the backend (nodemon, auto-restarts on
`server/src` changes) and the Vite dev server together. Open http://localhost:5173/.

Equivalent, without the script:

```bash
npm install
npm run mock:writer          # optional: generates a fake growing log file at /tmp/mock-app.log
LOG_FILE=/tmp/mock-app.log npm run dev
```

Without a log file, Log Lens starts with no tab open — use the **+** button in the tab bar to pick
a file from the in-app directory browser, type a path directly, or open a remote query tab. JSON
Lens always starts with no tab open — its own empty state offers a blank draft, opening a file, or
adding a folder to browse.

Custom backend port: `LOG_LENS_PORT=7780 ./start.sh /path/to/file.log`.

## JQL — Log Lens's filter language

Type in the filter box — matching is case-insensitive by default (toggle with the `Aa` button)
and re-runs on every keystroke against everything currently buffered (up to the last 5000 lines,
configurable via `LOG_LENS_MAX_LINES`). A **visual mode** (pill-based builder, toggled from the
toolbar) reads/writes the exact same query string for the common case (AND'd `field:value` clauses
optionally OR'd into groups) — anything more exotic (bare terms, nested parens) just falls back to
one "advanced" pill holding the raw text.

| Syntax | Meaning |
|---|---|
| `foo bar` | AND (default) — line must contain both `foo` and `bar` |
| `foo OR bar` | OR — lower precedence than AND, so `a b OR c d` means `(a AND b) OR (c AND d)` |
| `-foo` | NOT — line must not contain `foo` |
| `"foo bar"` | Quoted phrase — spaces included |
| `field:value` | JSON-path filter — line's field must contain `value` (substring, dot-path) |
| `field:*` | Field-presence filter — line must have this field (key exists), any value including `null` |
| `field:null` | Field is present *and* its value is explicitly JSON `null` — distinct from absence |
| `field:(a,b,c)` | Field matches any of the listed values (OR over the list) |
| `err*` / `*Exception` | Wildcard — anchored full-match against a field value, unanchored substring search against a bare term |
| `-field:value` / `-field:*` | NOT versions of the above |

Any matching line can be expanded ("Show more") into a flattened field table or a raw/pretty
JSON code viewer; toggling "+ Column" on a field table row adds it as its own column across every
line (a *folder* — a whole nested object — can be added as a column too, JSON-syntax-highlighted
in place). Right-click a line for more actions, including **Send to JSON Lens**, which opens its
(pretty-printed, if parseable) content as a new JSON Lens tab.

## Controls

- **Highlight** — toggle between hiding non-matching lines (default) and showing every buffered
  line with matches highlighted and non-matches dimmed.
- **Find** — a separate always-non-destructive find-in-view bar (⌘F/Ctrl+F), distinct from the
  filter box: highlights and steps through matches without removing any lines.
- **Presets** — save the current filter under a name, reapply or delete it later (per-browser).
- **Autoscroll** — pull the view down automatically as new matching lines arrive (file tabs only).
- **Pause** — stop rendering new lines while reading; resuming re-renders anything buffered
  since.
- **Pin** — pin any line (gets a distinct background); pinned lines are listed in the "More" menu
  for quick jump-back regardless of the current filter.
- **Clear** — clears the browser's view only, not the server's buffer or (for a file tab) the
  underlying file.

## Env vars

| Var | Default | Purpose |
|---|---|---|
| `LOG_FILE` | *(none)* | Path to a file to tail on startup |
| `LOG_LENS_PORT` | `7772` | Backend HTTP port |
| `LOG_LENS_MAX_LINES` | `5000` | Server-side ring buffer size, per tab |
| `LOG_LENS_POLL_MS` | `300` | How often the tail loop checks a file for new bytes |
| `ES_USERNAME` / `ES_PASSWORD` | *(none)* | Basic Auth for remote query tabs. Can also be set from the app's Credentials modal. |
| `LOG_LENS_BACKEND` | `http://localhost:7772` | (client-side, Vite dev server only) Where `/api` requests get proxied to |

## Remote query tabs

Besides tailing a local file, a Log Lens tab can query a configured Elasticsearch/OpenSearch-shaped
HTTP search backend directly — click **+** and switch to **Remote query** in the picker. Which
environments exist, their index/collection pattern(s), and which fields get their own first-class
"fold filter" chip input are **configuration, not hardcoded** — nothing in `server/src` names a
specific company's index or field. Fold filters are defined **per index**, not per environment,
since different indices commonly have unrelated field schemas (see
`server/log-lens.settings.example.json` for the shape). Configure via the app's **Preferences ›
Environments** modal (saved into `~/.log-lens-state.json`), or seed a fresh checkout from
`server/log-lens.settings.json` (git-ignored — copy the `.example.json`). Credentials are held
server-side only, resolved in this order: value saved via **Preferences › Credentials** >
`server/.env` (git-ignored, copy `server/.env.example`) > process environment variables.

Query tabs aren't live-tailed — click **Fetch new** to pull matches; refetching (e.g. after
widening the time range) is safe, since the server tracks which backend document IDs it's already
pushed for that tab and skips duplicates. The **Raw request** box shows the exact JSON body that
would be sent, live-generated from the fold filters/date range/KQL above it — edit it directly to
take full manual control; a manual edit overrides everything else in the form for that tab.

### Testing without a real backend

```bash
npm run mock:es                                          # starts a fake ES on :9201
cp server/log-lens.settings.mock.json server/log-lens.settings.json
```

`mock-es-server.js` is a dependency-free stand-in for Elasticsearch/OpenSearch (`_msearch`,
`_mapping`, terms aggregations) with a generated dataset, so remote query tabs can be exercised
fully offline. `log-lens.settings.mock.json` points an environment at it.

## JSON Lens

A folder tree (multiple roots at once) in the sidebar lets you browse and open any `.json` file on
disk — edited in a full CodeMirror editor (undo/redo, find/replace, fold all/unfold all, go-to-line,
zoom, inline JSON lint diagnostics including duplicate-key warnings) and saved back with **Save**
(⌘S) or **Save as…**. A tab that isn't bound to a disk file yet ("new") still autosaves its content
to the browser (localStorage) so a refresh never loses it; closing it with unsaved content prompts
to save it to a file, save it as a **scratch** (a real file server-side under
`~/.log-lens-scratches/`, but never one you picked or see in your own folders — reopen it from the
sidebar's Scratches list any time), or discard it.

Field-filtering (fuzzy search a field name, pick from ambiguous matches, view just those fields
read-only) and Format/Minify/Sort-keys/Escape/Unescape/indent-selection round out the toolbar.

## Project layout

Both `server/src/` and `client/src/` are split into `shared/` (used by more
than one tool) and one directory per tool (`logLens/`, `jsonLens/`) — see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full rationale (it's
deliberate, to keep the two tools' work independent of each other) and the
protocol for changing anything in `shared/`.

```
log-lens/
├── start.sh              # one-click dev launcher (nodemon + Vite)
├── server/                # Fastify backend
│   ├── src/
│   │   ├── index.js           # entry point — registers every route plugin
│   │   ├── shared/              # fileBrowser.js — directory listing, used by both tools' file pickers
│   │   ├── logLens/              # tabs/, es/, routes/, settings.js, credentials.js, sse.js, state.js
│   │   └── jsonLens/              # store.js (roots + scratches), files.js (disk I/O), routes.js
│   ├── log-lens.settings.example.json   # committed template — copy to .json to use
│   └── mocks/              # dependency-free test doubles (mock-log-writer.js, mock-es-server.js)
├── client/                # Vite + React frontend
│   └── src/
│       ├── App.jsx              # app shell: mode-switcher mounting all tools at once
│       ├── App.css                # shell + genuinely shared component styling
│       ├── shell/                  # ModeSidebar.jsx, useAppMode.js, useTheme.js — the shell itself
│       ├── shared/                  # components/, hooks/, render/, api/ — reusable, no tool-specific logic
│       ├── logLens/                  # LogViewerApp.jsx + its own components/, hooks/, filter/, render/, api/, LogLens.css
│       └── jsonLens/                  # JsonFormatterApp.jsx + its own components/, hooks/, api/, JsonLens.css
└── docs/                  # ARCHITECTURE.md, ROADMAP.md, JQL.md, API.md, PERSISTENCE.md
```

Persisted state lives outside the repo, in the home directory:

| File/dir | Tool | Contents |
|---|---|---|
| `~/.log-lens-state.json` | Log Lens | open tabs, saved credentials, UI-edited environment settings |
| `~/.log-lens-json-state.json` | JSON Lens | open folder roots, scratch metadata (name/id/timestamp) |
| `~/.log-lens-scratches/` | JSON Lens | one file per scratch document, named by id |

`server/log-lens.settings.json` and `server/.env` are git-ignored — never committed; see "Remote
query tabs" above.

## Status

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the detailed done/planned breakdown. In short: Log
Lens and JSON Lens are both fully functional; an HTTP Lens (Postman-style client) is scoped in
`docs/ROADMAP.md` but shelved, not yet built.
