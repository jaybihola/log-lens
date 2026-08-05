import { registerSseClient } from '../sse.js';
import { allTabs } from '../tabs/registry.js';

export default async function eventRoutes(fastify) {
  fastify.get('/api/events', (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    registerSseClient(reply, allTabs());
  });
}
