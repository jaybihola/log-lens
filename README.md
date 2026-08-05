# log-lens

Tails a log file and streams it to a browser, with a client-side filter language (JQL) that
re-scans instantly as you type — no server round-trip. Built for grepping noisy local debug output
(a server or test run redirected to a file, or a "save console output to file" run option) without
scrolling a terminal. Can also query a remote Elasticsearch/OpenSearch-shaped search backend
directly (see "Remote query tabs" below).

This is a ground-up, better-organized rewrite of an earlier single-file prototype (kept for
reference under `local/references/log-viewer/`, not part of this app). See
[`local/references/log-viewer/docs/ARCHITECTURE.md`](local/references/log-viewer/docs/ARCHITECTURE.md)
for the full, implementation-independent behavior spec this rewrite is targeting, and
[`docs/ROADMAP.md`](docs/ROADMAP.md) for what's built so far vs. still planned.

## Stack

- **Backend** — Node + [Fastify](https://fastify.dev/), in `server/`. Tails files, holds a
  per-tab ring buffer, and pushes new lines to the browser over Server-Sent Events.
- **Frontend** — React + Vite, in `client/`. All filtering/highlighting happens client-side
  against the buffered lines — retyping a filter re-scans instantly with no network round trip.
  Full-document JSON views (the raw-request editor, a line's "Show more" → JSON tab) use
  [CodeMirror 6](https://codemirror.net/) (`@uiw/react-codemirror`) for real syntax highlighting,
  folding, and editing; the compact inline log view uses its own lightweight regex highlighter
  since it's rendering thousands of short lines, not one document.
- Two npm workspaces (`server`, `client`) under one root `package.json`. Planned: an Electron
  shell wrapping the same client build for a native desktop app.

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

Without a log file, the app starts with no tab open — use the **+** button in the tab bar to pick
a file from the in-app directory browser, type a path directly, or open a remote query tab.

Custom backend port: `LOG_LENS_PORT=7780 ./start.sh /path/to/file.log`.

## JQL — this app's filter language

Type in the filter box — matching is case-insensitive by default (toggle with the `Aa` button)
and re-runs on every keystroke against everything currently buffered (up to the last 5000 lines,
configurable via `LOG_LENS_MAX_LINES`).

| Syntax | Meaning |
|---|---|
| `foo bar` | AND (default) — line must contain both `foo` and `bar` |
| `foo OR bar` | OR — lower precedence than AND, so `a b OR c d` means `(a AND b) OR (c AND d)` |
| `-foo` | NOT — line must not contain `foo` |
| `"foo bar"` | Quoted phrase — spaces included |
| `field:value` | JSON-path filter — line's field must contain `value` (substring, dot-path) |
| `field:*` | Field-presence filter — line must have this field, any value |
| `-field:value` / `-field:*` | NOT versions of the above |

Any matching line can be expanded ("Show more") into a flattened field table or a raw/pretty
JSON code viewer; toggling "+ Column" on a field table row adds it as its own column across every
line.

## Controls

- **Highlight** — toggle between hiding non-matching lines (default) and showing every buffered
  line with matches highlighted and non-matches dimmed.
- **Presets** — save the current filter under a name, reapply or delete it later (per-browser).
- **Autoscroll** — pull the view down automatically as new matching lines arrive (file tabs only).
- **Pause** — stop rendering new lines while reading; resuming re-renders anything buffered
  since.
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

## Remote query tabs

Besides tailing a local file, a tab can query a configured Elasticsearch/OpenSearch-shaped HTTP
search backend directly — click **+** and switch to **Remote query** in the picker. Which
environments exist, their index/collection pattern(s), and which fields get their own first-class
"fold filter" chip input are **configuration, not hardcoded** — nothing in `server/src` names a
specific company's index or field. Fold filters are defined **per index**, not per environment,
since different indices commonly have unrelated field schemas (see
`server/log-lens.settings.example.json` for the shape). Configure via the app's **Remote query
settings** modal (saved into `~/.log-lens-state.json`), or seed a fresh checkout from
`server/log-lens.settings.json` (git-ignored — copy the `.example.json`). Credentials are held
server-side only, resolved in this order: value saved via the **Credentials** modal >
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

## Project layout

```
log-lens/
├── start.sh            # one-click dev launcher (nodemon + Vite)
├── server/             # Fastify backend
│   ├── src/
│   │   ├── index.js        # entry point
│   │   ├── tabs/             # tab lifecycle + file tailing + remote-query fetch
│   │   ├── es/                # KQL-ish query builder, index/field-value caches
│   │   ├── routes/            # HTTP route plugins
│   │   ├── settings.js        # remote-query environment config
│   │   ├── credentials.js     # server-side-only ES credentials
│   │   ├── sse.js             # SSE broadcast
│   │   ├── state.js           # ~/.log-lens-state.json persistence
│   │   └── fileBrowser.js     # directory listing for the file picker
│   ├── log-lens.settings.example.json   # committed template — copy to .json to use
│   └── mocks/           # dependency-free test doubles (mock-log-writer.js, mock-es-server.js)
├── client/              # Vite + React frontend
│   └── src/
│       ├── api/             # fetch wrappers
│       ├── hooks/            # useTabs (tab state + SSE), useLiveEvents, useExtraColumns
│       ├── filter/            # JQL parser/matcher
│       ├── render/            # JSON extraction, syntax highlighting, field table, code viewer
│       └── components/        # TabBar, FilePicker, RemoteQueryModal, SettingsModal, EntryView, …
└── docs/                # ROADMAP.md
```

Persisted state (open tabs, saved credentials, UI-edited settings) lives in
`~/.log-lens-state.json`, outside the repo. `server/log-lens.settings.json` and `server/.env` are
git-ignored — never committed.

## Status

Core file tailing, live streaming, multi-tab, the file picker, the JQL dialect (AND/OR/NOT/quoted
phrases/`field:`), JSON/plain-text syntax highlighting, level detection, an expandable per-line
field table + raw code viewer, user-defined extra columns, remote Elasticsearch/OpenSearch query
tabs (with autocompleting fold-filter chips), saved filter presets, and highlight-only mode are all
implemented — see [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's left (an Electron shell). The
structured SQL-like JQL dialect, console/JSON pairing, and the `only:` projection filter are
intentionally out of scope for now.
