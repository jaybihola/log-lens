# API reference

Every HTTP route the backend exposes, grouped by feature area. All bodies
are JSON; all responses are JSON except the SSE stream. Base URL in dev is
`http://localhost:7772` (proxied from the Vite dev server at `/api`, see
`client/vite.config.js`). No auth on any of these — this is a local,
single-user dev tool.

See `docs/ARCHITECTURE.md` for how these are implemented; this file is the
contract, not the implementation.

## Health

**`GET /api/health`** → `{ ok: true }`

## Log Lens — tabs

A tab is `{ id, kind: "file"|"api", file, status, environment, queryConfig, fetchError }`
(`tabSummary()` shape) — `file` is the resolved absolute path for file tabs,
`environment`/`queryConfig` are set for api tabs, `status` is one of
`idle`/`waiting`/`watching`/`missing`/`fetching`/`error`.

| | | |
|---|---|---|
| `GET /api/tabs` | → `{ tabs: TabSummary[], activeTabId }` | List all tabs |
| `POST /api/tabs` | body `{ path? }` or `{ kind: "api", environment, queryConfig }` | Create a file tab (path optional — an empty tab waits for `.../open`) or an api tab |
| `POST /api/tabs/:id/open` | body `{ path }` | Point an existing file tab at a new path, resetting its buffer |
| `POST /api/tabs/:id/query` | body `{ environment, queryConfig }` | Reconfigure an api tab's query — resets buffer + dedup set |
| `POST /api/tabs/:id/fetch` | → `{ added, total }` | Run the api tab's configured query, push any unseen hits. 502 on backend failure |
| `POST /api/tabs/:id/activate` | → `{ ok: true }` | Mark as the active tab (persisted, restored on next boot) |
| `GET /api/tabs/:id/history` | → `{ lines: {seq, text}[], file, status, kind, environment, queryConfig, fetchError }` | Full buffered history — used on tab open/reconnect |
| `POST /api/tabs/:id/clear` | → `{ ok: true }` | Empty the buffer |
| `DELETE /api/tabs/:id` | → `{ ok: true }` | Close the tab, stop tailing/polling |

All return `404 { error }` for an unknown `:id`; tab-creation routes return
`400 { error }` for an invalid/missing environment.

## Log Lens — live stream

**`GET /api/events`** — Server-Sent Events. One shared stream for every
open tab (the client filters client-side by `tabId`). Events:

- `event: boot`, `data: { bootId }` — sent once on connect; a changed
  `bootId` across a reconnect means the server process restarted, not just
  a dropped connection (see `useLiveEvents.js`).
- `event: status`, `data: { tabId, status, file, fetchError }` — on every
  tab status change, plus once per existing tab immediately on connect.
- unnamed `data: { tabId, seq, text }` — one new (possibly continuation-joined)
  log line.
- `: heartbeat` comment every 15s (keeps the connection alive through proxies).

## Log Lens — file browsing

**`GET /api/browse?dir=&showHidden=`** → `{ dir, parent, entries: {name, isDir}[] }`
— directory listing for the file picker, defaults to the home directory,
folders sorted before files. `parent` is `null` at the filesystem root.
`400 { error, dir }` on an unreadable path.

## Log Lens — remote query settings

**`GET /api/settings`** → the full settings object (`{ environments: [...] }`
— see `server/log-lens.settings.example.json` for the shape).

**`POST /api/settings`** — body is a full settings object, replaces it
wholesale (normalized/validated first — invalid environments are silently
dropped, not errored on). Persists immediately.

## Log Lens — credentials

Credentials are `{ id, name, username }` when listed (password never
round-trips once saved).

| | | |
|---|---|---|
| `GET /api/credentials` | → `{ credentials: [...] }` | |
| `POST /api/credentials` | body `{ name?, username, password? }` → `{ id }` | `400` if `username` missing |
| `PUT /api/credentials/:id` | body `{ name?, username?, password? }` → `{ ok: true }` | `404` if unknown id |
| `DELETE /api/credentials/:id` | → `{ ok: true }` | |

## Log Lens — Elasticsearch integration

**`POST /api/es-query-preview`** — body `{ environment, queryConfig }` →
`{ body }` (the exact `_msearch` request body that a fetch would send) or
`{ error }`. Always `200` even on error (called on every form edit, a hard
failure would be disruptive) — see `es/fieldCache.js`'s `buildSearchBody`.

**`GET /api/es-field-values?environment=&field=&index=`** → `{ values: string[] }`
— a configured fold filter's distinct values (an ES terms aggregation,
cached for the process lifetime). `400` if the environment/index/field
combination isn't configured; `502` on a backend error.

**`GET /api/index-fields?environment=&index=`** → `{ fields: {name, type, detectedType, overridden}[] }`
— every field in the index's mapping, flattened to dot-paths, with any
saved type override applied (`type` is the effective type; `detectedType`
is always what ES actually reported). `400`/`502` as above.

## JSON Lens — open folder roots

**`GET /api/json-lens/roots`** → `{ roots: string[] }`

**`POST /api/json-lens/roots`** — body `{ path }` → `{ roots }`. `400` if
`path` doesn't exist or isn't a directory.

**`DELETE /api/json-lens/roots`** — body `{ path }` → `{ roots }`. Removing
a root doesn't touch the folder on disk, just stops browsing it.

## JSON Lens — browsing

**`GET /api/json-lens/browse?dir=&showHidden=`** → same shape as Log Lens's
`/api/browse`, but filtered to directories + `.json` files only (folders are
always shown regardless of contents, so you can navigate into one even if
nothing inside matches yet).

## JSON Lens — files on disk

| | | |
|---|---|---|
| `GET /api/json-lens/file?path=` | → `{ path, content }` | Read a file's raw text |
| `POST /api/json-lens/file` | body `{ path, content }` → `{ path }` | Write (create or overwrite) a file |
| `GET /api/json-lens/file-exists?path=` | → `{ exists: boolean }` | Used before an overwriting Save As |
| `DELETE /api/json-lens/file?path=` | → `{ ok: true }` | Delete a file |
| `POST /api/json-lens/file/rename` | body `{ from, to }` → `{ path }` | Rename/move a file |

All return `400 { error }` on any filesystem error (not found, permission
denied, etc.) rather than a specific status code per failure kind.

## JSON Lens — scratches

A scratch is `{ id, name, updatedAt }` when listed — content is fetched
separately. Scratch content lives as a real file server-side under
`~/.log-lens-scratches/<id>.json`, but is never exposed through the folder
browsing endpoints above.

| | | |
|---|---|---|
| `GET /api/json-lens/scratches` | → `{ scratches: [...] }` | |
| `POST /api/json-lens/scratches` | body `{ name?, content? }` → the created scratch | |
| `GET /api/json-lens/scratches/:id` | → `{ content }` | `404` if unknown |
| `PUT /api/json-lens/scratches/:id` | body `{ name?, content? }` → the updated scratch | `404` if unknown |
| `DELETE /api/json-lens/scratches/:id` | → `{ ok: true }` | |
