# log-lens — Roadmap

Tracks what's built vs. planned for this rewrite. The full behavior spec being targeted is
[`local/references/log-viewer/docs/ARCHITECTURE.md`](../local/references/log-viewer/docs/ARCHITECTURE.md)
(from the earlier single-file prototype this app replaces) — with a few deliberate deviations
noted below.

## Done

- Fastify backend: tab registry, file tailing (poll + truncation detection), SSE broadcast,
  ring buffer + history endpoint, directory-browsing file picker API, state persistence
  (`~/.log-lens-state.json`).
- React frontend: tab bar, file picker, live SSE-driven log view, autoscroll/pause/clear,
  nodemon-backed dev workflow (`./start.sh`).
- JQL filter: AND/OR/NOT, quoted phrases, `field:value` / `field:*`, case-sensitivity toggle.
- JSON/XML/plain-text syntax highlighting, log-level detection + color coding, long-line
  truncation, boot-id-based reconnect handling (survives a backend restart).
- Expandable line detail — "Show more" opens a flattened field table (dot/bracket paths) and a
  line-numbered/foldable raw code viewer.
- Extra columns — user-defined JSON dot-paths shown as their own column, toggled from the field
  table, persisted per-browser.
- Remote Elasticsearch/OpenSearch query tabs — config-driven environments/indices/fold filters
  (`server/log-lens.settings.json`, git-ignored — see `.example.json`), server-side credential
  handling (Settings-modal-saved > `.env` > process env), a KQL-ish query builder, quick date
  ranges, fold-filter chip inputs with live autocomplete, dedup-on-refetch, and a
  `mock-es-server.js` test double.
- Saved filter presets — name/reapply/delete a filter query, persisted per-browser.
- Highlight-only mode — show every buffered line, dim non-matches instead of hiding them.

## Planned

- Electron shell wrapping the same client build, for a native desktop app.

## Deliberately out of scope (for now)

The prototype has these; we've decided not to port them until there's a concrete need:

- **`only:<path>` JQL projection** — collapsing a matching line down to just one field's value.
  Removed from the simple dialect; will get a different design later rather than being ported
  as-is.
- **Structured SQL-like JQL dialect** (`SELECT ... WHERE ...`) — sticking to the simple dialect
  only.
- **Console/JSON pairing heuristic** — visually linking a structured JSON entry with its
  traditional leveled console twin.
