#!/usr/bin/env node
// mock-es-server.js — A small, dependency-free stand-in for an Elasticsearch/
// OpenSearch cluster, built to exercise the remote-query features without
// touching real infrastructure: multiple indices, _msearch (bool/match_phrase/
// range/query_string queries + terms aggregations), and _mapping (for the
// field-name cache).
//
// Usage:
//   node mocks/mock-es-server.js [port]
//   MOCK_ES_PORT=9202 node mocks/mock-es-server.js
//
// Point the real app at it: open the Remote query picker → Settings, and add
// an environment like:
//   { "name": "mock", "url": "http://localhost:9201/_msearch?pretty" }
// then add indices "logs-app-*" and "logs-worker-*", and fold filters such as:
//   { "key": "type", "label": "Type", "path": "event.type" }
//   { "key": "status", "label": "Status", "path": "event.status" }
// See log-lens.settings.mock.json in this directory for a ready-made copy —
// copy it over log-lens.settings.json (or paste its contents into the
// Settings modal) to point the app at this mock server directly.
//
// Any Basic Auth credentials are accepted (the value isn't checked) — only
// that the header is present — so you can also test the app's "Credentials
// not set" error path by leaving credentials unconfigured.

import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.argv[2] || process.env.MOCK_ES_PORT || 9201);
const DOC_COUNT = Number(process.env.MOCK_ES_DOC_COUNT || 1200);

// ---- Dataset generation ---------------------------------------------------

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Skewed so the app's default "Last 1h" quick-range picker actually returns
// results out of the box (~40% of docs land in the last hour) while still
// spreading the rest across `days` for testing wider time-range filters.
function randomTimestampWithinLastDays(days) {
  const now = Date.now();
  const past = Math.random() < 0.4
    ? now - Math.random() * 60 * 60 * 1000
    : now - Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(past).toISOString();
}

function generateAppLogs(count) {
  const types = ['Fetch', 'Create', 'Update', 'Delete'];
  const statuses = ['Started', 'Completed', 'Failed'];
  const errorTypes = ['TimeoutException', 'ValidationException', 'UpstreamUnavailableException'];
  const hosts = ['app-01', 'app-02', 'app-03'];
  const docs = [];
  for (let i = 0; i < count; i++) {
    const status = randomOf(statuses);
    // ~90% of failures carry an error type; successes/starts rarely do, to give
    // fold-filter/field-presence testing real signal.
    const errorType = status === 'Failed'
      ? (Math.random() < 0.9 ? randomOf(errorTypes) : null)
      : (Math.random() < 0.05 ? randomOf(errorTypes) : null);
    const type = randomOf(types);
    docs.push({
      _id: crypto.randomUUID(),
      '@timestamp': randomTimestampWithinLastDays(7),
      event: { type, status, durationMs: Math.round(20 + Math.random() * 2000) },
      error: { type: errorType },
      message: status === 'Failed'
        ? `${type} failed${errorType ? ` with ${errorType}` : ''}`
        : `${type} ${status.toLowerCase()}`,
      host: randomOf(hosts),
      traceId: crypto.randomUUID(),
    });
  }
  return docs;
}

function generateWorkerLogs(count) {
  const names = ['SyncData', 'SendNotification', 'CleanupTempFiles', 'GenerateReport'];
  const statuses = ['Queued', 'Running', 'Completed', 'Failed'];
  const errorTypes = ['TimeoutException', 'IOException'];
  const workers = ['worker-1', 'worker-2'];
  const docs = [];
  for (let i = 0; i < count; i++) {
    const status = randomOf(statuses);
    const errorType = status === 'Failed' && Math.random() < 0.85 ? randomOf(errorTypes) : null;
    const name = randomOf(names);
    docs.push({
      _id: crypto.randomUUID(),
      '@timestamp': randomTimestampWithinLastDays(7),
      job: { name, status, attempt: 1 + Math.floor(Math.random() * 3) },
      error: { type: errorType },
      message: status === 'Failed' ? `${name} job failed` : `${name} job ${status.toLowerCase()}`,
      worker: randomOf(workers),
    });
  }
  return docs;
}

// Index-pattern string -> documents. The mock matches the exact string the
// client sends in the _msearch header (no wildcard expansion) — configure
// the real app's "Indices" settings with these exact strings.
const DATASETS = {
  'logs-app-*': generateAppLogs(DOC_COUNT),
  'logs-worker-*': generateWorkerLogs(Math.round(DOC_COUNT * 0.4)),
};

// ---- Mappings (drives the /_mapping endpoint → the app's field-name cache) ----

const textField = () => ({ type: 'text', fields: { keyword: { type: 'keyword' } } });
const keywordField = () => ({ type: 'keyword' });
const longField = () => ({ type: 'long' });
const dateField = () => ({ type: 'date' });

const MAPPINGS = {
  'logs-app-*': {
    properties: {
      '@timestamp': dateField(),
      event: { properties: { type: textField(), status: textField(), durationMs: longField() } },
      error: { properties: { type: textField() } },
      message: textField(),
      host: textField(),
      traceId: keywordField(),
    },
  },
  'logs-worker-*': {
    properties: {
      '@timestamp': dateField(),
      job: { properties: { name: textField(), status: textField(), attempt: longField() } },
      error: { properties: { type: textField() } },
      message: textField(),
      worker: textField(),
    },
  },
};

// ---- Query evaluation (a small subset of ES Query DSL — enough to cover
// everything buildEsQuery.js ever sends) -----------------------------------

function getPath(obj, path) {
  return path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}

function matchesQuery(doc, query) {
  if (!query) return true;
  if (query.match_all) return true;
  if (query.bool) {
    const b = query.bool;
    if (Array.isArray(b.must) && !b.must.every((c) => matchesQuery(doc, c))) return false;
    if (Array.isArray(b.must_not) && b.must_not.some((c) => matchesQuery(doc, c))) return false;
    if (Array.isArray(b.should) && b.should.length) {
      const min = b.minimum_should_match || 1;
      const hits = b.should.filter((c) => matchesQuery(doc, c)).length;
      if (hits < min) return false;
    }
    return true;
  }
  if (query.match_phrase) {
    const [field, value] = Object.entries(query.match_phrase)[0];
    const actual = getPath(doc, field.replace(/\.keyword$/, ''));
    // Real match_phrase is exact-phrase, not substring — this mock loosens it
    // to a case-insensitive substring match, close enough for filter testing.
    return actual !== undefined && actual !== null && String(actual).toLowerCase().includes(String(value).toLowerCase());
  }
  if (query.range) {
    const [field, range] = Object.entries(query.range)[0];
    const actual = getPath(doc, field);
    const t = Date.parse(actual);
    if (Number.isNaN(t)) return false;
    if (range.gte && t < Date.parse(range.gte)) return false;
    if (range.lte && t > Date.parse(range.lte)) return false;
    return true;
  }
  if (query.query_string) {
    const needle = String(query.query_string.query || '').toLowerCase();
    return JSON.stringify(doc).toLowerCase().includes(needle);
  }
  return true;
}

function computeTermsAgg(docs, field, size) {
  const bareField = field.replace(/\.keyword$/, '');
  const counts = new Map();
  docs.forEach((doc) => {
    const v = getPath(doc, bareField);
    if (v === undefined || v === null) return;
    counts.set(String(v), (counts.get(String(v)) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, size || 500)
    .map(([key, doc_count]) => ({ key, doc_count }));
}

// ---- _msearch: ndjson request/response ------------------------------------

function parseNdjson(raw) {
  const lines = raw.split('\n').filter((l) => l.trim().length);
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) {
    try {
      pairs.push([JSON.parse(lines[i]), JSON.parse(lines[i + 1])]);
    } catch {
      pairs.push([null, null]);
    }
  }
  return pairs;
}

function handleMsearch(raw) {
  const pairs = parseNdjson(raw);
  const responses = pairs.map(([header, body]) => {
    if (!header) return { error: { type: 'parse_exception', reason: 'malformed ndjson request' } };
    const dataset = DATASETS[header.index];
    if (!dataset) {
      return { error: { type: 'index_not_found_exception', reason: `no such index [${header.index}]` } };
    }
    if (body.aggs && body.aggs.vals && body.aggs.vals.terms) {
      const buckets = computeTermsAgg(dataset, body.aggs.vals.terms.field, body.aggs.vals.terms.size);
      return { hits: { total: { value: 0 }, hits: [] }, aggregations: { vals: { buckets } } };
    }
    const matched = dataset.filter((doc) => matchesQuery(doc, body.query));
    matched.sort((a, b) => new Date(a['@timestamp']) - new Date(b['@timestamp']));
    const size = Number.isFinite(body.size) ? body.size : 200;
    const hits = matched.slice(0, size).map((doc) => ({ _index: header.index, _id: doc._id, _source: doc }));
    return { hits: { total: { value: matched.length }, hits } };
  });
  return { responses };
}

// ---- HTTP server ------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      mock: 'elasticsearch',
      indices: Object.keys(DATASETS).map((k) => ({ pattern: k, docCount: DATASETS[k].length })),
      usage: 'POST /_msearch (ndjson), GET /<index>/_mapping — see file header comment for setup',
    }, null, 2));
    return;
  }

  // Everything else requires *a* Basic Auth header — value isn't checked, so
  // any username/password "works" once set in the app; leaving it unset in
  // the app exercises the app's own "Credentials not set" error path.
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'security_exception', reason: 'missing authentication credentials' } }));
    return;
  }

  if (url.pathname === '/_msearch' && req.method === 'POST') {
    readBody(req).then((raw) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(handleMsearch(raw)));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'parse_exception', reason: 'could not read request body' } }));
    });
    return;
  }

  const mappingMatch = url.pathname.match(/^\/([^/]+)\/_mapping$/);
  if (mappingMatch && req.method === 'GET') {
    const index = decodeURIComponent(mappingMatch[1]);
    const mapping = MAPPINGS[index];
    if (!mapping) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'index_not_found_exception', reason: `no such index [${index}]` } }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ [index]: { mappings: mapping } }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { type: 'not_found', reason: 'no such route' } }));
});

server.listen(PORT, () => {
  console.log(`[mock-es] listening on http://localhost:${PORT}/`);
  Object.entries(DATASETS).forEach(([pattern, docs]) => {
    console.log(`[mock-es]   index "${pattern}": ${docs.length} documents`);
  });
  console.log(`[mock-es] point an environment at: http://localhost:${PORT}/_msearch?pretty`);
});
