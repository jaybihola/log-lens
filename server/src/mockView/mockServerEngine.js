import http from 'node:http';
import crypto from 'node:crypto';
import { getMockServer } from './store.js';

// Each running mock server is its own real http.Server, not a route hot-
// registered into the shared Fastify instance — Fastify doesn't support
// adding/removing routes at runtime well, and a mock server needs to be
// started/stopped/rebound to a different port on demand. Runtime state
// (the listener + its traffic log) lives only here, in memory, keyed by
// server id — never persisted (see store.js's load() comment).
const runtime = new Map(); // id -> { httpServer, hits: [] }

const MAX_HITS = 100;
const TEMPLATE_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

function renderTemplate(str, ctx) {
  if (typeof str !== 'string' || !str.includes('{{')) return str;
  return str.replace(TEMPLATE_RE, (match, expr) => {
    if (expr === 'uuid') return crypto.randomUUID();
    if (expr === 'now') return new Date().toISOString();
    const parts = expr.split('.');
    if (parts[0] !== 'request') return match;
    let cur = ctx;
    for (const p of parts.slice(1)) {
      if (cur == null) return match;
      cur = cur[p];
    }
    return cur === undefined ? match : String(cur);
  });
}

// "/orders/:id/status" -> a regex plus the param names in capture order.
function compilePattern(pattern) {
  const paramNames = [];
  const segments = (pattern || '/').split('/').map((seg) => {
    if (seg.startsWith(':')) {
      paramNames.push(seg.slice(1));
      return '([^/]+)';
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { regex: new RegExp(`^${segments.join('/')}/?$`), paramNames };
}

function matchRoute(routes, method, pathname) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const { regex, paramNames } = compilePattern(route.path);
    const m = regex.exec(pathname);
    if (!m) continue;
    const params = {};
    paramNames.forEach((name, i) => { params[name] = m[i + 1]; });
    return { route, params };
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw));
    req.on('error', () => resolve(''));
  });
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function recordHit(id, hit) {
  const state = runtime.get(id);
  if (!state) return;
  state.hits = [hit, ...state.hits].slice(0, MAX_HITS);
}

async function handleRequest(id, req, res) {
  const start = performance.now();
  const url = new URL(req.url, 'http://localhost');
  const rawBody = await readBody(req);
  let parsedBody;
  try { parsedBody = rawBody ? JSON.parse(rawBody) : undefined; } catch { parsedBody = rawBody; }

  const server = getMockServer(id);
  const match = server ? matchRoute(server.routes, req.method, url.pathname) : null;

  if (!match) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `No mock route matches ${req.method} ${url.pathname}` }));
    recordHit(id, { id: crypto.randomUUID(), method: req.method, path: url.pathname, status: 404, timeMs: Math.round(performance.now() - start), at: Date.now() });
    return;
  }

  const { route, params } = match;
  if (route.delayMs > 0) await sleep(route.delayMs);

  const ctx = { params, query: Object.fromEntries(url.searchParams), body: parsedBody };
  const body = renderTemplate(route.body || '', ctx);
  const contentType = body.trim().startsWith('{') || body.trim().startsWith('[') ? 'application/json' : 'text/plain';
  res.writeHead(route.status, { 'Content-Type': contentType });
  res.end(body);

  recordHit(id, { id: crypto.randomUUID(), method: req.method, path: url.pathname, status: route.status, timeMs: Math.round(performance.now() - start), at: Date.now() });
}

export function startMockServer(id) {
  if (runtime.has(id)) return { ok: true, alreadyRunning: true };
  const server = getMockServer(id);
  if (!server) return { ok: false, error: 'Mock server not found' };

  const httpServer = http.createServer((req, res) => {
    handleRequest(id, req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Mock server internal error' }));
    });
  });

  return new Promise((resolve) => {
    httpServer.once('error', (err) => {
      resolve({ ok: false, error: err.code === 'EADDRINUSE' ? `Port ${server.port} is already in use` : err.message });
    });
    httpServer.listen(server.port, () => {
      runtime.set(id, { httpServer, hits: [] });
      resolve({ ok: true });
    });
  });
}

export function stopMockServer(id) {
  const state = runtime.get(id);
  if (!state) return { ok: true, alreadyStopped: true };
  state.httpServer.close();
  runtime.delete(id);
  return { ok: true };
}

export function mockServerStatus(id) {
  const state = runtime.get(id);
  return { running: !!state, hitCount: state ? state.hits.length : 0 };
}

export function mockServerTraffic(id) {
  return runtime.get(id)?.hits || [];
}
