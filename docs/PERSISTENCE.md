# Persistence map

Every place this app stores state, client- or server-side, what's in it, and
how to reset it. Nothing app-generated is ever written inside the repo
itself. See `docs/ARCHITECTURE.md`'s "Persistence philosophy" section for
*why* the two server-side patterns differ.

## Server-side (home directory)

| File/dir | Written by | Contents | Reset |
|---|---|---|---|
| `~/.log-lens-state.json` | `server/src/logLens/state.js`, via `logLens/tabs/registry.js`'s `persistTabs()` | `{ activeTabId, tabs: [{path} \| {kind:"api", environment, queryConfig}], credentials: [{id,name,username,password}], settings: {environments:[...]} }` | Delete the file — next boot starts with no tabs, default settings, no credentials |
| `~/.log-lens-json-state.json` | `server/src/jsonLens/store.js` | `{ roots: string[], scratches: [{id,name,updatedAt}] }` | Delete the file — open folders and the scratch *list* are forgotten, but scratch content files (below) are orphaned, not deleted |
| `~/.log-lens-scratches/<id>.json` | `server/src/jsonLens/store.js` | One scratch's raw content, one file per scratch | Delete individual files, or the whole directory |

`persistTabs()` re-serializes the *entire* `~/.log-lens-state.json` blob on
every mutation across tabs/credentials/settings — see ARCHITECTURE.md for why
this is called out as worth eventually splitting apart, not a pattern to
extend.

## Server-side (repo-adjacent, git-ignored)

These aren't runtime-written state — they're operator config, edited by hand
or via the app's Preferences UI (which then also mirrors a copy into
`~/.log-lens-state.json`'s `settings`/`credentials` fields, taking
precedence over the file below on next boot — see `restoreFromState()` in
`logLens/tabs/registry.js`).

| File | Purpose | Template |
|---|---|---|
| `server/log-lens.settings.json` | Remote-query environments/indices/fold filters | `server/log-lens.settings.example.json` |
| `server/.env` | `ES_USERNAME`/`ES_PASSWORD` — seeds one credential on first boot only | `server/.env.example` |

## Client-side (localStorage)

Every key below follows the same shape: loaded once on hook init (tolerating
missing/malformed data), saved on every change, `try`/`catch`-wrapped since
`localStorage` can throw (private browsing, quota). All are per-browser, not
synced anywhere — clearing site data resets every one of these at once.

| Key | Hook | Shape |
|---|---|---|
| `log-lens-app-mode` | `shell/useAppMode.js` | `"logs"` \| `"json"` |
| `log-lens-theme` | `shell/useTheme.js` | `"light"` \| `"dark"` |
| `log-lens-display-settings` | `logLens/hooks/useDisplaySettings.js` | `{ fontSize }` (Log Lens's log view) |
| `log-lens-column-widths` | `logLens/hooks/useColumnWidths.js` | `{ ts, badge, extra: { [columnKey]: width } }` |
| `log-lens-filter-mode` | `logLens/hooks/useFilterMode.js` | `"text"` \| `"visual"` |
| `log-lens-filter-presets` | `logLens/hooks/usePresets.js` | `{ name, query }[]` |
| `log-lens-recent-files` | `logLens/hooks/useRecentFiles.js` | `string[]` (paths, most-recent first, max 8) |
| `log-lens-fields-sidebar-open` / `log-lens-fields-sidebar-width` | `logLens/hooks/useFieldsSidebar.js` | boolean / number |
| `log-lens-json-sidebar-open` / `log-lens-json-sidebar-width` | `jsonLens/hooks/useJsonSidebar.js` | boolean / number |
| `log-lens-json-tabs` | `jsonLens/hooks/useJsonTabs.js` | `{ tabs: JsonTab[], activeId }` — see shape below |
| `log-lens-json-editor-font-size` | `jsonLens/JsonFormatterApp.jsx` (module-level, not a hook) | number |

`useFieldsSidebar.js` and `useJsonSidebar.js` are two separate hooks with
independent, non-namespaced keys rather than one shared parameterized hook —
see ARCHITECTURE.md/ROADMAP.md; a deliberate choice while building JSON Lens,
not yet unified.

### `log-lens-json-tabs`'s `JsonTab` shape

```
{
  id, name,
  origin: "new" | "file" | "scratch",
  filePath: string | null,      // set when origin === "file"
  scratchId: string | null,     // set when origin === "scratch"
  content: string,               // current editor content
  savedContent: string,          // last confirmed-persisted content — dirty = content !== savedContent
  selectedFields: string[],      // active field-filter selection
}
```

This is the **only** place JSON Lens tab content lives for a `"new"`
(never-saved-anywhere) tab — closing the browser tab or navigating away
doesn't lose it, since it's written on every keystroke (debounced by
React's own batching, not an explicit debounce). For `"file"`/`"scratch"`
tabs, this is a convenience cache, not the source of truth — the real
content is what's on disk / in the scratch file server-side; this local
copy exists so reopening the app doesn't require a round trip before you
can see what you were editing.

## Resetting everything

```bash
rm ~/.log-lens-state.json ~/.log-lens-json-state.json
rm -rf ~/.log-lens-scratches
```

Then clear the site's local storage from the browser (dev tools → Application
→ Local Storage → right-click → Clear) to also drop the client-side keys
above.
