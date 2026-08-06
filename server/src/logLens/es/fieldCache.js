import fs from 'node:fs';
import { environmentUrl, fieldTypeOverrides, foldFilterByKey, getEnvironment } from '../settings.js';
import { getCredentialById } from '../credentials.js';
import { buildEsQuery } from './queryBuilder.js';
import { INDEX_FIELDS_STATE_FILE } from '../../config.js';

const ES_TIMESTAMP_SORT = [{ '@timestamp': { order: 'asc' } }];
const ES_DEFAULT_SIZE = 200;
const ES_MAX_SIZE = 10000; // Elasticsearch's default index.max_result_window — the real ceiling

// Distinct values per environment+index+field, for the chip inputs'
// autocomplete. Cached for the life of the process — the tool restarts often
// enough (dev tool, not a long-lived service) that a stale value sticking
// around isn't worth adding invalidation for.
const fieldValuesCache = new Map();

// Each index's field name+type pairs — "environment:index" -> Map<fieldName, type>.
// Deliberately *not* fetched from `_mapping`: a dedicated mapping request is a
// real, unbounded, cluster-taxing metadata operation (some production indices
// here run 80k+ fields, or index *patterns* fanning out to many concrete
// indices), and firing one just because a tab became active or a Preferences
// pane got opened — not because a user deliberately asked for it — isn't a
// risk this tool should take. Instead, fields are derived purely from the
// `_source` of real search hits (see `mergeObservedFields`, called from
// `runEsSearch`), so nothing is ever indexed unless a user actually ran that
// query. Persisted to disk (see `loadFieldsCache`/`persistFieldsCache`) since
// it's meant to accumulate across restarts, not reset to empty every time —
// the whole point is that it keeps growing over the app's lifetime.
const indexFieldsCache = loadFieldsCache();

function loadFieldsCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(INDEX_FIELDS_STATE_FILE, 'utf8'));
    const map = new Map();
    for (const [cacheKey, fields] of Object.entries(parsed || {})) {
      map.set(cacheKey, new Map(Object.entries(fields || {})));
    }
    return map;
  } catch {
    return new Map();
  }
}

function persistFieldsCache() {
  try {
    const obj = {};
    for (const [cacheKey, fields] of indexFieldsCache) obj[cacheKey] = Object.fromEntries(fields);
    fs.writeFileSync(INDEX_FIELDS_STATE_FILE, JSON.stringify(obj));
  } catch {
    // not fatal — persistence just won't survive a restart
  }
}

function authHeader(creds) {
  return `Basic ${Buffer.from(`${creds.username}:${creds.password || ''}`).toString('base64')}`;
}

// Each environment picks a credential by id (settings.js's credentialId) —
// there's no single global credential anymore, since different environments
// commonly need different auth.
function resolveCredential(environmentName) {
  const env = getEnvironment(environmentName);
  if (!env || !env.credentialId) return null;
  return getCredentialById(env.credentialId);
}

function requireCredential(environmentName) {
  const creds = resolveCredential(environmentName);
  if (!creds) throw new Error('No credential assigned to this environment — set one in Preferences › Environments');
  return creds;
}

// Recursively flattens a real hit's `_source` into dot-path fields, inferring
// a type label from the JS value itself (typeof / Array.isArray / null) —
// there's no ES mapping to read anymore. Known, accepted trade-off: this is
// necessarily less precise than ES's own mapping types — it can't tell
// `keyword` from `text`, or `long`/`integer`/`float` apart (all "number"),
// and a date shows up as "string" like any other. An array of objects has
// its items' fields flattened into the same paths (mirroring how ES itself
// doesn't distinguish "field" from "array of that field" in a mapping); an
// array of scalars is just labeled "array".
function flattenDocValues(value, prefix, out) {
  if (value === null || value === undefined) {
    if (prefix) out.set(prefix, 'null');
    return out;
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      if (prefix) out.set(prefix, 'array');
      return out;
    }
    if (value.some((v) => v && typeof v === 'object' && !Array.isArray(v))) {
      value.forEach((item) => flattenDocValues(item, prefix, out));
    } else if (prefix) {
      out.set(prefix, 'array');
    }
    return out;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) {
      if (prefix) out.set(prefix, 'object');
      return out;
    }
    entries.forEach(([key, v]) => flattenDocValues(v, prefix ? `${prefix}.${key}` : key, out));
    return out;
  }
  if (prefix) out.set(prefix, typeof value);
  return out;
}

// Merges newly-seen field names (from real search hits) into an
// environment+index's accumulated cache. Existing entries are left alone —
// once a field's type has been observed it isn't churned on every later
// query — only genuinely new field names get added, so the list only ever
// grows.
function mergeObservedFields(cacheKey, hits) {
  let fields = indexFieldsCache.get(cacheKey);
  if (!fields) {
    fields = new Map();
    indexFieldsCache.set(cacheKey, fields);
  }
  let changed = false;
  for (const hit of hits) {
    const flat = flattenDocValues(hit._source, '', new Map());
    for (const [name, type] of flat) {
      if (!fields.has(name)) {
        fields.set(name, type);
        changed = true;
      }
    }
  }
  if (changed) persistFieldsCache();
}

// Returns each field as { name, type, detectedType, overridden }: `type` is
// the effective type (a saved override, if any, else the hit-derived type),
// `detectedType` is always the raw hit-derived type — kept separate so the
// Preferences UI can show "detected: string" next to an active override
// without losing track of what was actually observed. A pure read of the
// accumulated cache — no live ES call, ever; an index nobody's queried yet
// just returns an empty list, not an error.
export async function fetchIndexFields(environment, index) {
  if (!index) throw new Error('no index specified');
  const cacheKey = `${environment}:${index}`;
  const fields = indexFieldsCache.get(cacheKey) || new Map();
  const overrides = fieldTypeOverrides(environment, index);
  return [...fields.entries()]
    .map(([name, type]) => (overrides[name]
      ? { name, type: overrides[name], detectedType: type, overridden: true }
      : { name, type, detectedType: type, overridden: false }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Fold filters are defined per index, so the index is required here (not
// defaulted) — a filter's meaning (and even existence) can differ across
// indices in the same environment.
export async function fetchFoldFieldValues(environment, index, filterKey) {
  if (!index) throw new Error('no index specified');
  const filter = foldFilterByKey(environment, index, filterKey);
  if (!filter) throw new Error(`unknown filter: ${filterKey}`);
  const cacheKey = `${environment}:${index}:${filterKey}`;
  if (fieldValuesCache.has(cacheKey)) return fieldValuesCache.get(cacheKey);
  const esUrl = environmentUrl(environment);
  if (!esUrl) throw new Error(`unknown environment: ${environment}`);
  const creds = requireCredential(environment);
  const keywordField = `${filter.path}.keyword`;
  const body = { size: 0, aggs: { vals: { terms: { field: keywordField, size: 500 } } } };
  const ndjson = `${JSON.stringify({ index })}\n${JSON.stringify(body)}\n\n`;
  const headers = { 'Content-Type': 'application/x-ndjson', Authorization: authHeader(creds) };
  const res = await fetch(esUrl, { method: 'POST', headers, body: ndjson });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ES request failed (${res.status}): ${text || res.statusText}`);
  }
  const json = await res.json();
  const response = json.responses?.[0];
  if (response?.error) throw new Error(response.error.reason ?? JSON.stringify(response.error));
  const values = (response?.aggregations?.vals?.buckets ?? []).map((b) => String(b.key));
  fieldValuesCache.set(cacheKey, values);
  return values;
}

function resolveIndex(environment, queryConfig) {
  const env = getEnvironment(environment);
  return queryConfig.index || (env && env.indices[0]?.pattern) || null;
}

// The exact JSON body that would be POSTed as the second ndjson line of the
// _msearch request. Shared by the real fetch and the "preview the raw
// request" editor, so what you see previewed is exactly what gets sent.
// `queryConfig.rawBody`, if present (a user-edited override from that
// editor), is used verbatim — it takes priority over fold filters, date
// range, and the KQL string entirely.
export function buildSearchBody(environment, queryConfig) {
  if (queryConfig.rawBody && typeof queryConfig.rawBody === 'object') {
    return queryConfig.rawBody;
  }
  const query = buildEsQuery(environment, queryConfig);
  let size = parseInt(queryConfig.size, 10);
  if (!Number.isFinite(size) || size <= 0) size = ES_DEFAULT_SIZE;
  size = Math.min(size, ES_MAX_SIZE);
  return { size, query, sort: ES_TIMESTAMP_SORT };
}

export async function runEsSearch(environment, queryConfig) {
  const esUrl = environmentUrl(environment);
  if (!esUrl) throw new Error(`unknown environment: ${environment}`);
  const creds = requireCredential(environment);
  const index = resolveIndex(environment, queryConfig);
  if (!index) throw new Error('no index configured for this environment — add one in Remote query settings');
  const body = buildSearchBody(environment, queryConfig);
  const ndjson = `${JSON.stringify({ index })}\n${JSON.stringify(body)}\n\n`;
  const headers = { 'Content-Type': 'application/x-ndjson', Authorization: authHeader(creds) };
  const res = await fetch(esUrl, { method: 'POST', headers, body: ndjson });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ES request failed (${res.status}): ${text || res.statusText}`);
  }
  const json = await res.json();
  const response = json.responses?.[0];
  if (response?.error) throw new Error(response.error.reason ?? JSON.stringify(response.error));
  const hits = response?.hits?.hits ?? [];
  // The only place fields ever get indexed: real hits from a real, user-run
  // search — never a dedicated request of their own. See the comment above
  // `indexFieldsCache`.
  if (hits.length) mergeObservedFields(`${environment}:${index}`, hits);
  return hits;
}
