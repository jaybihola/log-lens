import crypto from 'node:crypto';

// Changes every process start, so the browser can tell a `--watch` restart
// apart from a dropped connection and reload its tab list/buffers from scratch.
export const BOOT_ID = crypto.randomUUID();

const clients = new Set();

export function registerSseClient(reply, existingTabs) {
  clients.add(reply);
  reply.raw.write(`event: boot\ndata: ${JSON.stringify({ bootId: BOOT_ID })}\n\n`);
  for (const tab of existingTabs) {
    const payload = JSON.stringify({ tabId: tab.id, status: tab.status, file: tab.resolvedPath, fetchError: tab.fetchError });
    reply.raw.write(`event: status\ndata: ${payload}\n\n`);
  }

  const heartbeat = setInterval(() => {
    reply.raw.write(': heartbeat\n\n');
  }, 15000);

  reply.raw.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(reply);
  });
}

export function broadcastLine(tab, seq, text) {
  const payload = JSON.stringify({ tabId: tab.id, seq, text });
  for (const client of clients) client.raw.write(`data: ${payload}\n\n`);
}

export function broadcastStatus(tab) {
  const payload = JSON.stringify({
    tabId: tab.id,
    status: tab.status,
    file: tab.resolvedPath,
    fetchError: tab.fetchError,
  });
  for (const client of clients) client.raw.write(`event: status\ndata: ${payload}\n\n`);
}
