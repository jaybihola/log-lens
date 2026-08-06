import { environmentUrl, fieldTypeOverrides, foldFilterByKey, getEnvironment } from '../settings.js';
import { getCredentialById } from '../credentials.js';
import { buildEsQuery } from './queryBuilder.js';

const ES_TIMESTAMP_SORT = [{ '@timestamp': { order: 'asc' } }];
const ES_DEFAULT_SIZE = 200;
const ES_MAX_SIZE = 10000; // Elasticsearch's default index.max_result_window — the real ceiling

// Distinct values per environment+index+field, for the chip inputs'
// autocomplete, and each index's field name+type pairs (from its ES mapping)
// for path autocomplete and the JQL filter box. Cached for the life of the
// process — the tool restarts often enough (dev tool, not a long-lived
// service) that a stale value sticking around isn't worth adding invalidation
// for.
const fieldValuesCache = new Map();
const indexFieldsCache = new Map(); // "environment:index" -> { name, type }[] (raw, pre-override)

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

function mappingUrl(baseUrl, index) {
  const u = new URL(baseUrl);
  u.pathname = `/${index.split('/').map(encodeURIComponent).join('/')}/_mapping`;
  u.search = '';
  return u.toString();
}

// Flattens an ES mapping's nested `properties` (and `fields` multi-field)
// tree into dot-path leaf fields, each carrying its ES type (e.g. "keyword",
// "long", "date") so callers can show/use it without a second round trip.
function flattenMappingProperties(properties, prefix, out) {
  for (const [key, def] of Object.entries(properties || {})) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    if (def && typeof def === 'object' && def.properties) {
      flattenMappingProperties(def.properties, fieldPath, out);
    } else {
      out.push({ name: fieldPath, type: def?.type || 'unknown' });
      if (def && typeof def === 'object' && def.fields) {
        for (const [sub, subDef] of Object.entries(def.fields)) {
          out.push({ name: `${fieldPath}.${sub}`, type: subDef?.type || 'unknown' });
        }
      }
    }
  }
  return out;
}

// Returns each field as { name, type, detectedType, overridden }: `type` is
// the effective type (a saved override, if any, else the ES-detected type),
// `detectedType` is always the raw mapping type — kept separate so the
// Preferences UI can show "detected: text" next to an active override
// without losing track of what ES actually reported.
export async function fetchIndexFields(environment, index) {
  if (!index) throw new Error('no index specified');
  const cacheKey = `${environment}:${index}`;
  if (!indexFieldsCache.has(cacheKey)) {
    const esUrl = environmentUrl(environment);
    if (!esUrl) throw new Error(`unknown environment: ${environment}`);
    const creds = requireCredential(environment);
    const res = await fetch(mappingUrl(esUrl, index), { headers: { Authorization: authHeader(creds) } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`mapping request failed (${res.status}): ${text || res.statusText}`);
    }
    const json = await res.json();
    const byName = new Map();
    for (const indexDef of Object.values(json)) {
      flattenMappingProperties(indexDef?.mappings?.properties, '', []).forEach((f) => byName.set(f.name, f.type));
    }
    const sorted = [...byName.entries()].map(([name, type]) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name));
    indexFieldsCache.set(cacheKey, sorted);
  }
  const overrides = fieldTypeOverrides(environment, index);
  return indexFieldsCache.get(cacheKey).map(({ name, type }) => (overrides[name]
    ? { name, type: overrides[name], detectedType: type, overridden: true }
    : { name, type, detectedType: type, overridden: false }));
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
  return response?.hits?.hits ?? [];
}
