# Mock View — completion plan

Tracks what's left to bring Mock View to feature parity with the original
pitch (see the "Mock View — tool mockup" artifact from planning). This is a
plan document only — nothing here is built yet; see "Current state" for
what already exists. Written so a future session (or agent) can pick up any
one section independently without re-deriving the design decisions.

## Current state (done)

- **Request builder**: collections (one level of folders, each holding
  requests) + environments (`{{var}}` interpolation), Params/Headers/Body/
  Auth editors, server-proxied sending (`server/src/mockView/sender.js`),
  a status/timing/size response viewer. Request tabs are localStorage-
  persisted drafts (`useMockTabs.js`), collections/environments are
  server-synced (`useMockCollections.js`).
- **Mock server engine**: each mock server is a real `http.Server`, started/
  stopped on demand on its own port (`server/src/mockView/
  mockServerEngine.js`). Routes support static responses with `{{uuid}}`/
  `{{now}}`/`{{request.params|query|body.x}}` templating, resolved live on
  every hit. A polled traffic log (`useMockServers.js`, 1.5s interval)
  shows real incoming requests.
- **Shell integration**: reuses the app's actual `.app`/`.app-header`/
  `.app-body` structure, the shared tab-bar component shape, and the
  `.fields-sidebar` sidebar shell — not bespoke markup.

Persistence: `~/.log-lens-mock-state.json` (collections, environments,
mock-server configs — immediate-persist-per-mutator, same pattern as
`jsonLens/store.js`). Mock-server *running state* and the *traffic log* are
runtime-only (`mockServerEngine.js`'s in-memory `Map`), reset on restart —
deliberate, same reasoning as `logLens/sse.js`'s client `Set`.

## Remaining work

### 1. Code generation (easiest — do this first)

**What**: a "Code" tab in the request editor (alongside Params/Headers/
Body/Auth) that renders the current request as a copy-pasteable snippet —
curl at minimum, fetch/axios as stretch goals.

**Design**: pure string templating, no new state. A new
`client/src/mockView/codegen.js` (framework-free, like `interpolate.js`)
exporting `toCurl(tab, resolvedUrl, resolvedHeaders, resolvedBody)` →
string. Reuses `buildUrl`/`buildHeaders` from `requestUtils.js` — the
snippet should show exactly what would actually be sent (variables already
resolved), not the raw `{{var}}` template, so a copy-pasted curl command
works standalone outside the app.

**UI**: one more entry in `RequestBuilder.jsx`'s `SUBTABS` array; the pane
renders a read-only `<pre>` or a read-only `JsonEditor` (`language="text"`)
with a copy button (reuse `shared/components/CopyButton.jsx`).

**Effort**: small — no server changes, no new persisted state. Good
first-slice to build alone.

### 2. Sequence-mode routes

**What**: a mock route that cycles through N canned responses across
successive hits (e.g. 200 → 200 → 500 → repeat) instead of always
returning the same one — useful for testing retry/backoff logic against a
flaky-looking dependency.

**Design decisions**:
- **Data model**: `server/src/mockView/store.js`'s `makeRoute()` gains a
  `mode: 'static' | 'sequence'` field and, for sequence mode, a
  `sequence: [{ status, body }, ...]` array instead of the single
  top-level `status`/`body`. Keep `status`/`body` on the route object even
  in sequence mode (as the mode-switch default / fallback) so toggling
  `static ↔ sequence` in the editor doesn't lose data either direction.
- **Cursor state**: which step of the sequence a route is *currently* on
  is per-running-instance state, not config — lives in
  `mockServerEngine.js`'s runtime `Map` (alongside `hits`), reset every
  time the server (re)starts. Add a `sequenceCursors: Map<routeId,
  number>` to the per-server runtime entry; `handleRequest` increments
  `(cursor + 1) % route.sequence.length` after serving each hit.
- **Matching**: no change to `matchRoute()` — sequence is a per-matched-
  route response-selection concern, not a routing concern.

**Server changes**: `mockServerEngine.js`'s `handleRequest()` branches on
`route.mode` when building the response (static: use `route.status`/
`route.body` as today; sequence: read+advance the cursor, use
`route.sequence[cursor]`). `store.js`'s `makeRoute`/`updateMockRoute`
validate/normalize the `sequence` array.

**Client changes**: `RouteEditorModal.jsx` gets a mode toggle (mirrors
`RequestBuilder.jsx`'s Body mode toggle: `none`/`json`/`text` buttons —
same pattern, `static`/`sequence` here). Sequence mode replaces the single
status/body/JsonEditor block with a repeatable list of
`{status, body}` rows — **not** `KeyValueTable` (that's key/value shaped,
this is status/body shaped) — a small new `SequenceStepList.jsx` with
add/remove/reorder, each step's body its own small `JsonEditor`.
`MockServerDetail.jsx`'s routes table gains a "Mode" column
(`Static`/`Sequence (N steps)`) and the "Response" column shows either the
single status or `200 → 200 → 500 ↻` (join the sequence's statuses).

**Effort**: moderate. The riskiest part is making sure the cursor-reset-on-
restart behavior is obvious in the UI (a "reset sequence" affordance on the
route row is worth adding, so testing the same retry scenario twice
doesn't require restarting the whole server).

### 3. Pre-request / test scripts

**What**: a small script attached to a request, run before it's sent
(set headers/variables) and/or after the response arrives (assert on it,
extract values into an environment variable — e.g. pull a token out of a
login response for the next request to reuse).

**The real design decision — sandboxing**: running arbitrary user-authored
JS server-side needs a boundary. Two options, pick one before writing any
code:

- **Node's `vm` module** (`vm.createContext` + `vm.runInContext` with a
  timeout). Real JS — arbitrary expressiveness — but `vm` is *not* a
  security sandbox against a determined attacker (well-known escapes
  exist); acceptable here **only** because this is a single-user local dev
  tool running scripts the same user wrote, not untrusted third-party
  code. Still worth a hard execution timeout (e.g. 500ms) so a `while
  (true) {}` typo hangs one send, not the server process.
- **A tiny whitelisted DSL** (`env.set(key, value)`, `expect(x).toBe(y)`
  as the only two calls, parsed rather than `eval`'d). Safer, but real
  users will want a full `if`/loop eventually and the DSL will keep
  growing until it's a worse version of JS.

**Recommendation**: `vm` with a timeout, scoped to a local dev tool's
actual threat model (see above) — simpler to build, and the API surface
Postman/Insomnia users already expect (`pm.*`-style globals) maps directly
onto it. Call the global object `mock` instead of `pm` to match this
tool's own naming rather than copying Postman's API 1:1:
`mock.env.get(key)` / `mock.env.set(key, value)`, `mock.request` (method/
url/headers, read-only), and for the post-response script only:
`mock.response` (status/headers/body, read-only) and
`mock.expect(actual).toBe(expected)` / `.toContain(x)` accumulating a list
of `{ pass, message }` results.

**Data model**: request objects (`server/src/mockView/store.js`'s
`makeRequest`) gain `preRequestScript: string` and `testScript: string`
(both default `''`).

**Server changes**: new `server/src/mockView/scriptRunner.js` — 
`runPreRequest(script, { env, headers, url })` → mutated headers + any
`env.set()` calls collected as a patch to apply to the active environment;
`runTests(script, { response, env })` → `{ results: [...], envPatch }`.
Wire into the existing `POST /api/mock/send` handler:
pre-request runs before `sendHttpRequest()`, tests run after, both results
returned alongside the response so the client doesn't need a second
round-trip. **Environment mutation from a script is the trickiest wiring**:
the send route needs the active environment's variables *and* a way to
persist `env.set()` calls back through `store.js`'s `updateEnvironment` —
resolve this by having the route accept `activeEnvironmentId` in the
request body (client already knows it) and calling `updateEnvironment`
itself after a script's `env.set()` calls, same as any other mutation.

**Client changes**: two more `RequestBuilder.jsx` subtabs, "Scripts" (pre-
request, a `JsonEditor` with `language="text"`... actually worth checking
whether `@codemirror/lang-javascript` is worth adding as a dependency for
real JS syntax highlighting here, given every other editor in the app is
JSON/XML/plain — small scope call to make when this is actually built) and
"Tests" (post-response — but note the *results* render in
`ResponseViewer.jsx`'s existing "Tests" tab placeholder-shaped area, not
here; this tab is for editing the test script itself). `ResponseViewer.jsx`
gains a real Tests tab: pass/fail chips per assertion (mirrors the
`test-result`/`.pass` styling already sketched in the original mockup
artifact).

**Effort**: the largest single piece of remaining work — budget it as its
own session, not a quick add-on.

### 4. Collection runner

**What**: execute every request in a collection/folder sequentially,
non-interactively, and show a pass/fail summary (which requests errored,
which failed a test assertion, total time).

**Depends on**: pre-request/test scripts (#3) — without test scripts,
"pass/fail" has nothing to report per request beyond "got a response or
didn't," which is a much thinner feature. **Build #3 first.**

**Design**: server-side execution (`server/src/mockView/runner.js`) rather
than the client firing N sequential `POST /api/mock/send` calls — keeps
the whole run alive even if the browser tab is switched away mid-run, and
avoids N round-trips' worth of network overhead being visible as "the
runner is slow" when it's really just chatty HTTP. `POST /api/mock/
collections/:id/run` (optional `folderId`) synchronously runs every
request in order (reusing `sendHttpRequest`, and #3's `scriptRunner.js` if
present) and returns `{ results: [{ requestId, name, status, timeMs,
testResults }] }` in one response. A "Running…" spinner state on the
client covers the synchronous wait — no need for progress-streaming (SSE)
in a first cut, since a collection is realistically a handful to a few
dozen requests, not hundreds.

**Client changes**: a "Run collection" action in `MockSidebar.jsx`'s
collection/folder context menu (currently those rows only have inline
new-folder/new-request/delete buttons — this would be the first thing
that needs a real right-click context menu, i.e. adopting
`shared/hooks/useContextMenu.js` + `shared/components/ContextMenu.jsx`,
which neither `MockSidebar.jsx` nor `MockServersSidebar.jsx` currently
use). A new `RunResultsModal.jsx` (or a dedicated panel) listing each
request with a pass/fail/error pill and its timing.

**Effort**: moderate, mostly UI (the server-side execution loop itself is
straightforward once `sendHttpRequest`/`scriptRunner.js` exist).

## Suggested build order

1. **Code generation** — quick win, no design risk, ships in isolation.
2. **Sequence-mode routes** — moderate, no dependency on anything else.
3. **Pre-request/test scripts** — the big one; resolve the sandboxing
   decision (recommendation: `vm` + timeout) before writing code.
4. **Collection runner** — depends on #3 being done first.

## Other rough edges worth folding in whenever touched

Not from the original mockup, but noticed while building the pieces above:

- `MockSidebar.jsx`/`MockServersSidebar.jsx` have no context menus (right-
  click) — every other tree/list in the app (Log Lens's fields sidebar,
  JSON Lens's file sidebar, both tab bars) does. Worth fixing once the
  runner (above) needs one anyway, rather than as a separate pass.
- No rename affordance for mock servers or collections themselves (folders
  and requests can be renamed via their modals' name field on create, but
  there's no "rename this collection" or "rename this mock server" action
  after the fact) — small, low-risk addition whenever convenient.
- No import path (curl-paste-to-request, or OpenAPI/Postman collection
  JSON import) — mentioned in the original plan as a "Phase 2+" item, not
  scoped in detail here since nothing above depends on it.
