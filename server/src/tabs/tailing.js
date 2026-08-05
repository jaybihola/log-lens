import fs from 'node:fs';
import { broadcastLine, broadcastStatus } from '../sse.js';

// An indented physical line (stack trace frames, wrapped continuation text —
// the standard shape for e.g. dotnet console logging: "warn: Category[0]"
// followed by an indented message) is a continuation of the previous message,
// joined back together with real newlines. Anything else starts a new message.
const CONTINUATION_RE = /^[ \t]/;

export function pushLine(tab, text, maxLines) {
  tab.seq += 1;
  tab.buffer.push({ seq: tab.seq, text });
  if (tab.buffer.length > maxLines) tab.buffer.shift();
  broadcastLine(tab, tab.seq, text);
}

function flushPending(tab, maxLines) {
  if (tab.pendingLines.length) {
    pushLine(tab, tab.pendingLines.join('\n'), maxLines);
    tab.pendingLines = [];
  }
}

function ingestLine(tab, line, maxLines) {
  if (tab.pendingLines.length > 0 && CONTINUATION_RE.test(line)) {
    tab.pendingLines.push(line);
  } else {
    flushPending(tab, maxLines);
    tab.pendingLines.push(line);
  }
  // The last message in the file has no following message to flush it — flush
  // it on its own after a short quiet period instead.
  clearTimeout(tab.flushTimer);
  tab.flushTimer = setTimeout(() => flushPending(tab, maxLines), 400);
}

export function pollOnce(tab, tabs, maxLines) {
  if (!tab.resolvedPath || !tabs.has(tab.id)) return;
  fs.stat(tab.resolvedPath, (err, stat) => {
    if (!tabs.has(tab.id)) return; // tab was closed while stat() was in flight
    if (err) {
      if (tab.status !== 'missing') {
        tab.status = 'missing';
        broadcastStatus(tab);
      }
      return;
    }

    if (tab.status !== 'watching') {
      tab.status = 'watching';
      broadcastStatus(tab);
    }

    if (stat.size < tab.lastSize) {
      // File was truncated or replaced (e.g. a fresh debug run overwrote it).
      tab.lastSize = 0;
      tab.partial = '';
      tab.pendingLines = [];
      clearTimeout(tab.flushTimer);
    }

    if (stat.size === tab.lastSize) return;

    const toRead = stat.size - tab.lastSize;
    const startAt = tab.lastSize;
    tab.lastSize = stat.size;

    const stream = fs.createReadStream(tab.resolvedPath, {
      start: startAt,
      end: startAt + toRead - 1,
      encoding: 'utf8',
    });
    let chunk = '';
    stream.on('data', (d) => { chunk += d; });
    stream.on('end', () => {
      const combined = tab.partial + chunk;
      const lines = combined.split(/\r?\n/);
      tab.partial = lines.pop() || ''; // last element has no trailing newline yet
      for (const line of lines) {
        if (line.length > 0) ingestLine(tab, line, maxLines);
      }
    });
    stream.on('error', () => { /* transient; next poll retries */ });
  });
}

export function startPolling(tab, tabs, pollMs, maxLines) {
  if (tab.pollTimer) clearInterval(tab.pollTimer);
  tab.pollTimer = setInterval(() => pollOnce(tab, tabs, maxLines), pollMs);
  pollOnce(tab, tabs, maxLines);
}

export function stopPolling(tab) {
  if (tab.pollTimer) {
    clearInterval(tab.pollTimer);
    tab.pollTimer = null;
  }
  clearTimeout(tab.flushTimer);
}
