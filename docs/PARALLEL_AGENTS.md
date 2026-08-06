# Working on log-lens with multiple agents

A practical playbook for running more than one agent (or person) on this
repo at the same time. See [`ARCHITECTURE.md`](ARCHITECTURE.md)'s
"Directory structure" section for *why* the tree is split the way it is —
this doc is the operational rules that split was built to support.

## The domain map

Everything in the tree falls into one of these lanes. Two agents working in
different lanes almost never touch the same file; two agents working in the
same lane will.

| Lane | Directories | Parallel-safe? |
|---|---|---|
| Log Lens | `server/src/logLens/`, `client/src/logLens/` | Yes — one agent can own this end to end |
| JSON Lens | `server/src/jsonLens/`, `client/src/jsonLens/` | Yes — one agent can own this end to end |
| Shared | `server/src/shared/`, `client/src/shared/` | Careful — see "Touching `shared/`" below |
| Shell | `client/src/shell/` | Rarely touched; treat like `shared/` if it does come up |
| Entry points | `server/src/index.js`, `client/src/App.jsx`, `client/src/App.css` (imports only), `package.json` | Not parallel-safe — small, high-collision, edit serially |
| Docs | `README.md`, `client/README.md`, `server/README.md`, `docs/*.md` | Low collision risk (prose, not code) but still worth a light protocol — see below |

A tool-scoped agent should only need to touch its own lane plus, rarely, a
one-line addition to an entry point (e.g. registering a new route file in
`server/src/index.js`) or a doc.

## How many agents at once

**Two is the sweet spot right now**: one on Log Lens, one on JSON Lens. That
maps exactly onto the directory split and is what it was designed for —
each agent can work, build, and verify independently without waiting on the
other.

**Three works** if the third agent is doing something in its own new
directory — most plausibly `server/src/httpLens/` + `client/src/httpLens/`
once that tool gets picked up (see `ROADMAP.md`). A third agent scoped to
`shared/`-only work (e.g. a deliberate design-system pass) also works, but
expect it to spend time on rule 2 below (checking both other tools' usage)
rather than moving fast.

**Don't go past three concurrently** with the codebase at its current size.
The bottleneck isn't lane count, it's the small set of files every lane
eventually touches — `App.jsx`, `App.css`'s import lines, `index.js`,
`package.json`, and the docs. Those are small enough to serialize cheaply
between two or three agents; past that, the time spent resolving conflicts
on those shared touchpoints starts to exceed the time saved by adding
another parallel worker. If you find yourself wanting a fourth lane, it's a
signal to first check whether an existing lane should split further (e.g.
Log Lens's remote-query/ES feature is large enough it could become its own
sub-lane) rather than adding cross-cutting agents.

## Setting up

Git worktrees, one per agent, so nobody's uncommitted work collides on disk
or in a shared `node_modules`/dev-server state:

```bash
git worktree add ../log-lens-loglens -b agent/loglens
git worktree add ../log-lens-jsonlens -b agent/jsonlens
```

Each worktree needs its own `npm install` (workspaces + `node_modules`
aren't shared across worktrees) and should run its own dev servers on
different ports — override via `server/.env`'s port var and Vite's
`--port` flag, since both dev servers otherwise default to the same fixed
ports and a second instance will just fail to bind. Two agents fighting
over `localhost:5173` is a bad way to lose an afternoon.

## Touching `shared/` (or `shell/`)

Full rules and a real example live in `ARCHITECTURE.md`'s "Changing
something in `shared/`" section — summarized:

1. Additive only — new optional props/params with defaults that reproduce
   old behavior, never a changed signature.
2. Grep the *other* tool's usage after extending something, not just the
   tool that motivated the change. Silent drift (the other tool missing out
   on a new capability) is the failure mode here, not breakage.
3. Land `shared/` changes as their own commit, separate from the
   tool-specific feature that needed them.
4. If working in separate worktrees, merge `shared/` changes back to `main`
   first, ahead of the rest of that branch, so the other agent's branch
   isn't diverging from a `shared/` file it also depends on.

If a change to something in `shared/` turns out not to be additive (a real
signature change, a removed prop), stop and hand-merge it yourself rather
than letting two agents resolve it — this is the one class of conflict
worth a human/lead-agent in the loop before merging.

## Entry points: edit serially, keep the diff tiny

`server/src/index.js` and `client/src/App.jsx` are two-line-per-tool files
by design (register a route plugin; mount a `mode-pane` div) specifically so
concurrent edits are easy to merge by hand even if they land at the same
time — a new import line + a new `fastify.register(...)` call, or a new
import line + a new mode-pane div, rarely conflicts with another tool doing
the same thing elsewhere in the same file. Keep it that way: if a change to
one of these files grows beyond "add a line near the top, add a line near
the bottom," that's a sign the logic belongs in the tool's own directory
instead, called from a one-line hook in the entry point.

`package.json` (root) changes — new root scripts, new shared devDependencies
— should go through whichever agent gets there first, with the other
rebasing past it; these are rare enough not to need a protocol beyond "smallest
diff wins, rebase past it."

## Docs

Each tool-scoped README/doc section is owned by that tool's agent:
`client/src/logLens/README.md`, `client/src/jsonLens/README.md`, and every
tool-specific section inside `ARCHITECTURE.md`/`ROADMAP.md`/`API.md`/
`JQL.md`/`PERSISTENCE.md`. `client/src/shared/README.md` follows the same
rule as `shared/` code — additive, check both tools' entries are still
accurate after a change. Root `README.md` and this file are cross-cutting;
treat them like entry points (small diffs, rebase past conflicts) rather
than splitting ownership.

## When not to bother parallelizing

A change that's going to touch an entry point, `shared/`, and both tools'
directories in one sitting (a new cross-tool feature, a dependency bump, a
build-tooling change) isn't a good fit for two agents working independently
— the coordination overhead exceeds the benefit. Do those as a single
agent/session, and save the multi-agent split for work that's genuinely
scoped to one tool.
