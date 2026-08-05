#!/usr/bin/env node
// mock-log-writer.js — Continuously appends realistic, varied log lines to a file
// so the "Local file" tab (tailing, message-continuation joining, JSON/console
// pairing, level detection, syntax highlighting) can be tested against a live,
// growing file instead of a static fixture.
//
// Usage:
//   node mocks/mock-log-writer.js [path] [intervalMs]
//   node mocks/mock-log-writer.js /tmp/mock-app.log 500
//   MOCK_LOG_TRUNCATE_EVERY_MS=120000 node mocks/mock-log-writer.js   # also periodically
//     truncates/restarts the file, to test the tail's truncation-detection logic
//
// Then in the app: open a new tab → Local file → point at the same path.
// Ctrl-C to stop. The file is truncated on startup unless --append is passed.

import fs from 'node:fs';

const args = process.argv.slice(2).filter((a) => a !== '--append');
const APPEND = process.argv.includes('--append');
const LOG_PATH = args[0] || '/tmp/mock-app.log';
const INTERVAL_MS = Number(args[1] || 500);
const TRUNCATE_EVERY_MS = Number(process.env.MOCK_LOG_TRUNCATE_EVERY_MS || 0);

if (!APPEND) fs.writeFileSync(LOG_PATH, '');

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function append(text) {
  fs.appendFileSync(LOG_PATH, text + '\n');
}

const CATEGORIES = ['RequestHandler', 'Scheduler', 'CacheService', 'AuthService', 'SyncJob'];
const ERROR_TYPES = ['System.TimeoutException', 'System.InvalidOperationException', 'System.Net.Http.HttpRequestException'];

// A plain single-line info/debug entry — the common case, no continuation.
function writePlainLine() {
  const level = randomOf(['info', 'dbug', 'trce']);
  const category = randomOf(CATEGORIES);
  append(`${timestamp()} ${level}: ${category}[0]`);
  append(`      Handling request ${Math.floor(Math.random() * 100000)}`);
}

// A JSON structured-log entry followed shortly by its console-formatted twin —
// exercises the console/JSON "paired lines" heuristic (matched by category name).
function writePairedEntry() {
  const category = randomOf(CATEGORIES);
  const traceId = Math.random().toString(36).slice(2, 10);
  append(JSON.stringify({ Name: category, TraceId: traceId, Status: randomOf(['Started', 'Completed', 'Failed']) }));
  // A little jitter/interleaving before the console twin shows up, same as a real
  // async logging sink — the app's pairing search window tolerates this.
  if (Math.random() < 0.5) writePlainLine();
  append(`${timestamp()} info: ${category}[0]`);
  append(`      ${category} trace ${traceId} finished`);
}

// A multi-line stack trace — exercises continuation-joining (indented lines merge
// into the previous entry) and error-level highlighting.
function writeStackTrace() {
  const category = randomOf(CATEGORIES);
  const errorType = randomOf(ERROR_TYPES);
  append(`${timestamp()} fail: ${category}[0]`);
  append('      Unhandled exception processing request');
  append(`      ${errorType}: the operation could not be completed.`);
  append('         at MyApp.Service.DoWork() in /src/Service.cs:line 42');
  append('         at MyApp.Handler.Handle() in /src/Handler.cs:line 17');
  append('         at MyApp.Middleware.Invoke() in /src/Middleware.cs:line 9');
}

// A warn-level line with an embedded JSON blob mid-message — exercises the
// embedded-JSON extraction used by field columns/JQL field paths.
function writeEmbeddedJsonLine() {
  const category = randomOf(CATEGORIES);
  const payload = { RequestId: Math.floor(Math.random() * 100000), DurationMs: Math.floor(Math.random() * 2000) };
  append(`${timestamp()} warn: ${category}[0]`);
  append(`      Slow request detected ${JSON.stringify(payload)}`);
}

const WRITERS = [
  { weight: 5, fn: writePlainLine },
  { weight: 3, fn: writePairedEntry },
  { weight: 1, fn: writeStackTrace },
  { weight: 2, fn: writeEmbeddedJsonLine },
];
const TOTAL_WEIGHT = WRITERS.reduce((sum, w) => sum + w.weight, 0);

function writeOne() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const w of WRITERS) {
    if (r < w.weight) return w.fn();
    r -= w.weight;
  }
}

console.log(`[mock-log-writer] appending to ${LOG_PATH} every ${INTERVAL_MS}ms (Ctrl-C to stop)`);
const tickTimer = setInterval(writeOne, INTERVAL_MS);

let truncateTimer = null;
if (TRUNCATE_EVERY_MS > 0) {
  console.log(`[mock-log-writer] will also truncate/restart the file every ${TRUNCATE_EVERY_MS}ms`);
  truncateTimer = setInterval(() => {
    fs.writeFileSync(LOG_PATH, '');
    append(`${timestamp()} info: Startup[0]`);
    append('      Process restarted — file truncated');
  }, TRUNCATE_EVERY_MS);
}

process.on('SIGINT', () => {
  clearInterval(tickTimer);
  if (truncateTimer) clearInterval(truncateTimer);
  console.log('\n[mock-log-writer] stopped');
  process.exit(0);
});
