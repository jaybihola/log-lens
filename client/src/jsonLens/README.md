# jsonLens/

JSON Lens's own components/hooks/api — nothing outside this directory
(other than `shared/`, `shell/`, or the top-level `App.jsx`) imports from
here, and this directory should never import from `logLens/`. See
`docs/ARCHITECTURE.md` for the deeper narrative (the tab origin model,
save/scratch/discard flow, the filesystem hook) — this file is just a map.

## Top level

| File | What |
|---|---|
| `JsonFormatterApp.jsx` | The tool's entire top-level component — tabs, toolbar, field-filter, editor, and the save/close-tab decision-modal state machine |
| `jsonUtils.js` | Pure logic: JSON validation/error-location, format/minify/sort-keys, fuzzy field search, field-filter pruning, escape/unescape |
| `JsonLens.css` | This tool's own styling |

## `components/`

| File | What |
|---|---|
| `JsonFileSidebar.jsx` | Folder tree + scratches list, built on `shared/components/FieldTree.jsx` |
| `JsonTabBar.jsx` | JSON Lens's tab strip — dirty dot, rename, same context-menu-stays-active pattern as Log Lens's `TabBar` |

## `hooks/`

| File | What |
|---|---|
| `useJsonTabs.js` | Tabs: almost entirely localStorage (a JSON Lens "tab" is just an editor buffer, no server tab registry to sync). Tracks `origin` (`"new"`/`"file"`/`"scratch"`), `content` vs. `savedContent` for dirty-checking, exports `isTabDirty()` alongside the hook. No forced "always at least one tab." |
| `useJsonFileSystem.js` | The lazy-loaded folder tree (children fetched only on expand) plus the scratches list, backed by `api/jsonLensClient.js` |
| `useJsonSidebar.js` | JSON Lens's own sidebar open/width state — deliberately separate from Log Lens's `useFieldsSidebar.js`, not a shared namespaced hook; see `docs/ROADMAP.md` |

## `api/`

- **`jsonLensClient.js`** — fetch wrappers matching every JSON Lens server route (`jsonLens/routes.js`).
