import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempHome } from '../../../test/withTempHome.js';

let ctx;
let fastify;
let address;

beforeEach(async () => {
  ctx = await withTempHome();
  const Fastify = (await import('fastify')).default;
  const eventRoutes = (await import('./events.js')).default;
  fastify = Fastify();
  await fastify.register(eventRoutes);
  address = await fastify.listen({ port: 0, host: '127.0.0.1' });
});

afterEach(async () => {
  await fastify.close();
  ctx.cleanup();
});

// Reads Server-Sent Events off a real streamed response until `matcher`
// returns true for some received event, or `timeout` elapses.
async function collectEventsUntil(url, matcher, { timeout = 3000 } = {}) {
  const controller = new AbortController();
  const res = await fetch(url, { signal: controller.signal });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];
  const deadline = Date.now() + timeout;
  try {
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const eventMatch = /^event: (.+)$/m.exec(raw);
        const dataMatch = /^data: (.+)$/m.exec(raw);
        const evt = { event: eventMatch?.[1] ?? 'message', data: dataMatch?.[1], raw };
        events.push(evt);
        if (matcher(evt)) return events;
      }
    }
    throw new Error(`collectEventsUntil: timed out waiting for a matching event. Seen: ${JSON.stringify(events)}`);
  } finally {
    controller.abort();
  }
}

describe('GET /api/events (SSE)', () => {
  it('sends a boot event with a bootId immediately on connect', async () => {
    const events = await collectEventsUntil(`${address}/api/events`, (e) => e.event === 'boot');
    const boot = events.find((e) => e.event === 'boot');
    expect(typeof JSON.parse(boot.data).bootId).toBe('string');
  });

  it('sends a status event for each already-open tab on connect', async () => {
    const { createTab, closeTab } = await import('../tabs/registry.js');
    const tab = createTab(null); // no path -> no polling, nothing to clean up beyond closeTab
    try {
      const events = await collectEventsUntil(`${address}/api/events`, (e) => e.event === 'status');
      const status = events.find((e) => e.event === 'status');
      expect(JSON.parse(status.data).tabId).toBe(tab.id);
    } finally {
      closeTab(tab.id);
    }
  });

  it('broadcasts a line event to a connected client when a tab pushes one', async () => {
    const { createTab, closeTab } = await import('../tabs/registry.js');
    const { pushLine } = await import('../tabs/tailing.js');
    const tab = createTab(null);
    try {
      const collecting = collectEventsUntil(`${address}/api/events`, (e) => e.event === 'message' && e.data?.includes('hello from tailing'));
      // Give the connection a beat to register as a client before pushing.
      await new Promise((resolve) => setTimeout(resolve, 50));
      pushLine(tab, 'hello from tailing', 5000);
      const events = await collecting;
      const lineEvent = events.find((e) => e.data?.includes('hello from tailing'));
      expect(JSON.parse(lineEvent.data)).toMatchObject({ tabId: tab.id, text: 'hello from tailing' });
    } finally {
      closeTab(tab.id);
    }
  });
});
