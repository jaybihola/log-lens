# JQL — Log Lens's filter language

The full grammar, precedence rules, and edge cases. Implementation:
`client/src/logLens/filter/simpleJql.js` (tokenizer, parser, matcher),
`client/src/logLens/filter/compile.js` (the `{ matcher, terms, error }`
wrapper the rest of the app consumes), `client/src/logLens/filter/
visualClauses.js` (the pill builder's text ⇄ structured-clauses bridge).
Purely client-side — it filters whatever's already buffered in the browser,
no server round-trip, which is why it re-runs on every keystroke. Not
related to `server/src/logLens/es/queryBuilder.js`'s KQL-ish parser, which
builds an Elasticsearch request server-side instead; see
`docs/ARCHITECTURE.md`.

## Token types

| Token | Example | Matches |
|---|---|---|
| Bare term | `timeout` | Line's raw text contains `timeout` (substring, case-insensitive by default) |
| Quoted phrase | `"connection reset"` | Same, but the quotes let the phrase contain spaces |
| Field value | `field:value` | The JSON value at dot-path `field` contains `value` (substring) |
| Field presence | `field:*` | `field` exists as a key — matches even if its value is `null` |
| Field is null | `field:null` | `field` exists **and** its value is exactly JSON `null` |
| Field in-list | `field:(a,b,c)` | `field`'s value matches *any* of `a`, `b`, `c` (each evaluated with the same rules as a plain `field:value`) |
| Negation | `-term`, `-field:value`, `-field:*`, `-field:null`, `-field:(a,b)` | Inverts any of the above |
| Wildcard | `err*`, `*Exception`, `a*b` | `*` inside a term or field value — see "Wildcard semantics" below |
| OR | `foo OR bar` | Case-insensitive keyword; lowest precedence |
| AND | `foo bar` (implicit) or `foo AND bar` (explicit, redundant — `AND` is silently dropped by the tokenizer, adjacency already means AND) | |
| Grouping | `(a OR b) c` | Standard parenthesized grouping |

## Precedence and evaluation

Recursive-descent, three levels, tightest first: **grouping** (parens) →
**AND** (implicit, any two adjacent atoms) → **OR** (the `OR` keyword,
explicit only). So:

```
a b OR c d      ==      (a AND b) OR (c AND d)
a OR b c OR d    ==      a OR (b AND c) OR d
```

A malformed query (unbalanced parens, a trailing operator, `)` with no
matching `(`) throws during parsing. `compile.js` catches this and falls
back to a matcher that returns `true` for every line — **a typo in the
filter box never hides your buffer**; the parse error is surfaced
separately (as a message next to the filter box) instead. Keep this
fail-open behavior if you ever touch the parser.

## Field-path matching (`jsonPathRawValue`, `client/src/logLens/render/jsonPaths.js`)

`field` in any of the token types above is a dot/bracket path
(`Properties.CorrelationId`, `Tags[0].Name`) resolved against whatever JSON
object can be extracted from the line — tried in order: the whole line
parsed as JSON, then each physical line on its own (a continuation-joined
entry can bundle a plain-text header with a JSON payload), then the first
balanced `{...}` found anywhere in the text. A line with no extractable JSON
object simply has no matching fields — every `field:*`/`field:value` token
evaluates to "not present."

**Absence vs. null are distinct**, on purpose: `field:*` means the key
exists (any value, including `null`); `-field:*` means the key doesn't exist
at all; `field:null` means the key exists *and* its value is `null`. To ask
for "present with a real (non-null) value," combine two tokens with the
language's normal AND: `field:* -field:null`.

## Wildcard semantics (`globFullMatch` vs. `globSearch`)

`*` means different things depending on where it appears, because the two
cases have different useful defaults:

- **In a field value** (`field:err*`) — **anchored full match** (like
  Elasticsearch's own wildcard query convention): `err*` means "the value
  starts with `err`," not "contains `err` anywhere" — plain `field:err` with
  no wildcard already covers the "contains" case, so an anchored match is
  the one that adds something new.
- **In a bare term** (`err*`) — **unanchored search**: matches if the
  pattern is found anywhere in the line. Anchoring the *entire line* to a
  pattern would be useless against a full log line.

Everything else about `*` is standard glob: it can appear anywhere in the
pattern (`a*b`, `*mid*dle*`), and is converted to a regex by escaping every
other character and joining segments with `.*`.

## Case sensitivity

Off (case-insensitive) by default, toggled per-tab via the `Aa` button in
the toolbar — passed as `caseSensitive` through `compile.js` down to every
matcher. Applies uniformly to bare terms, field values, and wildcard
patterns.

## Highlighting

`highlightTermsForSimple(query)` extracts every *positive* (non-negated)
term/field-value/in-list-value from a parsed query — these are what gets
visually highlighted inline in matching lines. `*` (bare presence) and
`null` aren't real values to highlight, so they're excluded.

## The visual (pill) builder

Toggled from the toolbar; reads and writes the *exact same* `filterQuery`
string the text box uses — there is no separate "visual query" state. The
model is always **disjunctive normal form**: a list of groups, clauses
within a group ANDed, groups ORed against each other — `(a AND b) OR (c)`.
One group (the common case) needs no parens at all, since AND already binds
tighter than OR.

`decomposeQuery()` only succeeds when the *entire* query fits this shape —
every top-level segment (split at OR / paren boundaries) must be a flat
AND-sequence of `field:value`-family tokens with no bare terms and no
further nesting. The moment anything doesn't fit, the whole query becomes
one opaque "advanced" pill holding the raw text unmodified — this is
deliberate: silently misrepresenting a query the builder can't fully model
would be worse than admitting it can't parse it visually. Toggling back to
text mode always shows the exact, byte-for-byte original string either way.

Per-clause operators (`is`/`is not`/`is one of`/`is not one of`/`exists`/
`does not exist`/`is null`/`is not null`) map directly onto the token forms
above — see `OPERATORS` in `visualClauses.js` for the exact id/label/arity
table, and `clauseToJql()`/`tokenToClause()` for the two directions of the
mapping.
