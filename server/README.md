# server

Fastify backend for both Log Lens and JSON Lens. See the root
[`README.md`](../README.md) for what the app does and how to run it, and
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the full technical
picture (tailing algorithm, SSE protocol, ES query building, the two
persistence patterns) — this file is just a directory map, the route table,
and the dev commands.

## Dev commands

```bash
npm run dev -w server        # nodemon (server/nodemon.json), auto-restarts on src/ changes
npm run start -w server      # plain node, no auto-restart
npm run mock:writer -w server  # generates a fake growing log file at /tmp/mock-app.log
npm run mock:es -w server      # a dependency-free fake Elasticsearch on :9201 (see mocks/mock-es-server.js)
```

Usually run via the root `npm run dev` (or `./start.sh`), which starts this
alongside the client together. Config is read from `server/.env` (git-ignored
— copy `.env.example`) and CLI args / env vars (see the root README's "Env
vars" table); `server/log-lens.settings.json` (git-ignored — copy
`.example.json`, or seed `.mock.json` for the fake-ES setup above) holds
Log Lens's remote-query environment config.

## Directory map

`shared/`, `logLens/`, and `jsonLens/` are split deliberately so the two
tools can be worked on independently — see `docs/ARCHITECTURE.md`'s
"Directory structure" section before adding a file to `shared/`: it belongs
there only if a second tool genuinely uses it.

```
src/
├── index.js            entry point — registers every route plugin, restores state, starts listening
├── config.js             env/CLI config + every persisted-file path (all under the home directory, outside the repo)
├── shared/
│   └── fileBrowser.js       directory listing — used by both tools' file pickers
├── logLens/
│   ├── state.js               ~/.log-lens-state.json load/save — tabs/credentials/settings blob
│   ├── settings.js             remote-query environment config: normalize/get/set, per-index lookups
│   ├── credentials.js          server-side-only named Basic Auth credentials
│   ├── sse.js                   the SSE client set + broadcast helpers, boot-id generation
│   ├── tabs/
│   │   ├── registry.js             in-memory tab Map — create/open/close/activate, persistence
│   │   └── tailing.js               the poll loop: truncation detection, continuation-line joining, line push
│   ├── es/
│   │   ├── queryBuilder.js         a small hand-rolled KQL-ish parser -> Elasticsearch bool query (NOT the client's JQL)
│   │   └── fieldCache.js            index field list (accumulated from real hit `_source`s, never a dedicated mapping fetch — persisted to ~/.log-lens-fields-state.json) + fold-filter value fetch/cache, the actual ES/OpenSearch HTTP calls
│   └── routes/                one Fastify plugin per feature area — see the route table below
└── jsonLens/
    ├── store.js                its own state file (open roots + scratch metadata) — persists on every mutation, not via a separate step
    ├── files.js                 read/write/rename/delete/exists for arbitrary on-disk .json files
    └── routes.js                 all of JSON Lens's routes in one plugin (small enough not to need its own routes/ dir)
```

## Route map

| Method | Path | Plugin | What |
|---|---|---|---|
| GET | `/api/health` | `index.js` | Liveness check |
| GET | `/api/tabs` | `logLens/routes/tabs.js` | List Log Lens tabs |
| POST | `/api/tabs` | | Create a tab (file or `kind:"api"`) |
| POST | `/api/tabs/:id/open` | | Point a file tab at a new path |
| POST | `/api/tabs/:id/query` | | Reconfigure an api tab's query (resets its buffer/dedup set) |
| POST | `/api/tabs/:id/fetch` | | Run the configured query, push new (unseen) hits |
| POST | `/api/tabs/:id/activate` | | Mark a tab as the active one |
| GET | `/api/tabs/:id/history` | | Full buffered line history for a tab |
| POST | `/api/tabs/:id/clear` | | Clear a tab's buffer |
| DELETE | `/api/tabs/:id` | | Close a tab |
| GET | `/api/browse` | `logLens/routes/browse.js` | Directory listing (Log Lens's file picker) |
| GET | `/api/events` | `logLens/routes/events.js` | The SSE stream |
| GET/POST | `/api/settings` | `logLens/routes/settings.js` | Remote-query environment config |
| GET/POST/PUT/DELETE | `/api/credentials`(`/:id`) | `logLens/routes/credentials.js` | Named ES credentials CRUD |
| POST | `/api/es-query-preview` | `logLens/routes/esFields.js` | The exact search body a fetch would send, for the "raw request" editor |
| GET | `/api/es-field-values` | | Fold-filter chip autocomplete values |
| GET | `/api/index-fields` | | An index's accumulated field name/type list (pure read of the hit-derived cache, never a live ES call) |
| GET/POST/DELETE | `/api/json-lens/roots` | `jsonLens/routes.js` | JSON Lens's open folder roots |
| GET | `/api/json-lens/browse` | | `.json`-filtered directory listing |
| GET/POST | `/api/json-lens/file` | | Read/write an arbitrary on-disk JSON file |
| GET | `/api/json-lens/file-exists` | | Existence check (used before an overwriting Save As) |
| DELETE | `/api/json-lens/file` | | Delete a file |
| POST | `/api/json-lens/file/rename` | | Rename/move a file |
| GET/POST | `/api/json-lens/scratches` | | List/create scratches |
| GET/PUT/DELETE | `/api/json-lens/scratches/:id` | | Read/update/delete one scratch |

Full request/response shapes: [`docs/API.md`](../docs/API.md).

## Conventions worth knowing before touching this code

- **Every persisted file lives outside the repo**, under the home directory — see `config.js` for
  the full list. Never write app state into the repo itself.
- **Two deliberately different persistence patterns exist side by side** — Log Lens's monolithic
  `logLens/state.js` blob (every mutator must remember to call `persistTabs()`) vs. JSON Lens's
  `jsonLens/store.js` (every mutator persists itself immediately). See
  `docs/ARCHITECTURE.md`'s "Persistence philosophy" section before adding a third pattern — prefer
  extending JSON Lens's approach for new features, not Log Lens's.
- **A new tool's saved state should get its own file/module** under that tool's own directory, not
  fold into `logLens/state.js`'s blob — follow `jsonLens/store.js` as the template.
- **Config (environments, index patterns, field names) is never hardcoded** — nothing in `src/`
  should ever name a specific company's index, field, or URL. It all comes from
  `log-lens.settings.json` (git-ignored) or the app's own Preferences UI.
- **The two "query parsers" in this codebase are unrelated** — `logLens/es/queryBuilder.js`'s
  KQL-ish parser builds an Elasticsearch request server-side; `client/src/logLens/filter/
  simpleJql.js`'s JQL parser filters an already-fetched buffer client-side. Different grammars,
  different jobs, no shared code — don't assume a fix to one applies to the other. Full grammar
  reference for the latter: [`docs/JQL.md`](../docs/JQL.md).
- **Before adding a file to `shared/`**, read `docs/ARCHITECTURE.md`'s "Changing something in
  `shared/`" section — additive-only changes, and check the other tool's usage before moving on.
