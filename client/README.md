# client

React 19 + Vite frontend for both Log Lens and JSON Lens. See the root
[`README.md`](../README.md) for what the app does and how to run it, and
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the full technical
picture (the app-shell mode-switching pattern, the JQL grammar, persistence
philosophy, the shared component library, and — importantly if you're about
to edit something in `shared/` — the protocol for changing a file both tools
depend on) — this file is just a directory map and the dev commands.

## Dev commands

```bash
npm run dev -w client       # Vite dev server on :5173, proxies /api to the backend (see vite.config.js)
npm run build -w client     # production build to client/dist/
npm run lint -w client      # oxlint
```

Usually run via the root `npm run dev` (or `./start.sh`), which starts this
alongside the backend together.

## Directory map

`shared/`, `logLens/`, and `jsonLens/` are split deliberately so the two
tools can be worked on independently — see `docs/ARCHITECTURE.md`'s
"Directory structure" section before adding a new file: it belongs in
`shared/` only if a second tool genuinely uses it, otherwise it belongs in
that one tool's own directory even if the code looks generic.

```
src/
├── App.jsx           the app shell — mounts every tool at once, a mode-switcher hides/shows them
├── main.jsx             entry point
├── index.css               global theme CSS custom properties (light/dark via [data-theme])
├── App.css                    shell chrome + genuinely shared component styling
├── shell/                 ModeSidebar.jsx, useAppMode.js, useTheme.js — the app shell itself, not a tool
├── shared/                  reusable building blocks, used by 2+ tools — see docs/ARCHITECTURE.md's list
│   ├── components/            FieldTree, ContextMenu, Tooltip, ConfirmModal, PromptModal, FilePickerBody, EmptyState, JsonEditor, …
│   ├── hooks/                  useContextMenu.js
│   ├── render/                  fieldTree.js
│   └── api/                      http.js — the fetch primitives every tool's own api/ module builds on
├── logLens/                  Log Lens — everything below is this tool's own, nothing shared imports from here
│   ├── LogViewerApp.jsx         top-level component
│   ├── LogLens.css                this tool's own styling
│   ├── components/                 TabBar, EntryView, LineRow, Toolbar, FieldsSidebar, preferences/, …
│   ├── hooks/                       useTabs (the big one — tabs+buffers+SSE), useLiveEvents, usePresets, …
│   ├── filter/                       JQL tokenizer/parser/matcher + visual-builder decomposition
│   ├── render/                        pure display-logic helpers (jsonPaths, highlight, fieldTable, fieldStats, pairing, timestamp)
│   └── api/client.js
└── jsonLens/                 JSON Lens — same shape, its own everything
    ├── JsonFormatterApp.jsx     top-level component
    ├── jsonUtils.js               pure JSON logic (validate, format, fuzzy field search, escape/unescape)
    ├── JsonLens.css               this tool's own styling
    ├── components/                 JsonFileSidebar, JsonTabBar
    ├── hooks/                       useJsonTabs, useJsonFileSystem, useJsonSidebar
    └── api/jsonLensClient.js
```

## Conventions worth knowing before touching this code

- **No native browser dialogs anywhere** — no `window.confirm`/`window.prompt`/`<input
  type="checkbox">`/native `title` tooltips. Use `ConfirmModal`/`PromptModal`/toggle
  `<button>`s/`Tooltip` instead; see `docs/ARCHITECTURE.md`'s reusable-component-library section.
- **Comments explain *why*, not *what*** — a hidden constraint, a workaround, a non-obvious
  invariant. If removing a comment wouldn't confuse a future reader, it isn't there.
- **A malformed filter query never hides the buffer** — `logLens/filter/compile.js` falls back to
  "match everything" and surfaces the parse error separately, so a typo never looks like "all my
  logs disappeared." Follow the same principle for any future validation: fail visibly, not by
  silently hiding data.
- **`render/*.js` files are framework-free** — no React imports, so they're trivially reusable
  and testable in isolation. Keep new display-logic helpers there rather than inlining them in a
  component if they don't actually need JSX.
- Every localStorage-persisted hook follows the same shape: a `load()` that tolerates missing/
  malformed data (falls back to a sane default, never throws), a `useEffect` that saves on every
  change, wrapped in a `try/catch` since `localStorage` can throw (private browsing, quota). Copy
  an existing one (e.g. `logLens/hooks/useFilterMode.js`) rather than inventing a new shape.
- **Before changing a file in `shared/`**, read `docs/ARCHITECTURE.md`'s "Changing something in
  `shared/`" section — additive-only changes, and check the other tool's usage before moving on.
