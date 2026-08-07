import {
  listCollections, createCollection, renameCollection, deleteCollection,
  createFolder, renameFolder, deleteFolder,
  createRequest, updateRequest, deleteRequest,
  listEnvironments, createEnvironment, updateEnvironment, deleteEnvironment, setActiveEnvironment,
  listMockServers, createMockServer, updateMockServer, deleteMockServer,
  createMockRoute, updateMockRoute, deleteMockRoute,
} from './store.js';
import { sendHttpRequest } from './sender.js';
import { startMockServer, stopMockServer, mockServerStatus, mockServerTraffic } from './mockServerEngine.js';

export default async function mockViewRoutes(fastify) {
  // ---- collections ----
  fastify.get('/api/mock/collections', async () => ({ collections: listCollections() }));

  fastify.post('/api/mock/collections', async (req, reply) => {
    if (!req.body?.name) return reply.code(400).send({ error: 'name required' });
    return createCollection(req.body.name);
  });

  fastify.put('/api/mock/collections/:id', async (req, reply) => {
    const updated = renameCollection(req.params.id, req.body?.name);
    if (!updated) return reply.code(404).send({ error: 'Collection not found' });
    return updated;
  });

  fastify.delete('/api/mock/collections/:id', async (req) => {
    deleteCollection(req.params.id);
    return { ok: true };
  });

  // ---- folders ----
  fastify.post('/api/mock/collections/:id/folders', async (req, reply) => {
    const folder = createFolder(req.params.id, req.body?.name);
    if (!folder) return reply.code(404).send({ error: 'Collection not found' });
    return folder;
  });

  fastify.put('/api/mock/collections/:id/folders/:folderId', async (req, reply) => {
    const folder = renameFolder(req.params.id, req.params.folderId, req.body?.name);
    if (!folder) return reply.code(404).send({ error: 'Folder not found' });
    return folder;
  });

  fastify.delete('/api/mock/collections/:id/folders/:folderId', async (req) => {
    deleteFolder(req.params.id, req.params.folderId);
    return { ok: true };
  });

  // ---- requests ----
  fastify.post('/api/mock/collections/:id/requests', async (req, reply) => {
    const request = createRequest(req.params.id, req.body?.folderId || null, req.body?.request || {});
    if (!request) return reply.code(404).send({ error: 'Collection or folder not found' });
    return request;
  });

  fastify.put('/api/mock/collections/:id/requests/:requestId', async (req, reply) => {
    const updated = updateRequest(req.params.id, req.params.requestId, req.body || {});
    if (!updated) return reply.code(404).send({ error: 'Request not found' });
    return updated;
  });

  fastify.delete('/api/mock/collections/:id/requests/:requestId', async (req) => {
    deleteRequest(req.params.id, req.params.requestId);
    return { ok: true };
  });

  // ---- environments ----
  fastify.get('/api/mock/environments', async () => listEnvironments());

  fastify.post('/api/mock/environments', async (req, reply) => {
    if (!req.body?.name) return reply.code(400).send({ error: 'name required' });
    return createEnvironment(req.body.name);
  });

  fastify.put('/api/mock/environments/:id', async (req, reply) => {
    const updated = updateEnvironment(req.params.id, req.body || {});
    if (!updated) return reply.code(404).send({ error: 'Environment not found' });
    return updated;
  });

  fastify.delete('/api/mock/environments/:id', async (req) => {
    deleteEnvironment(req.params.id);
    return { ok: true };
  });

  fastify.post('/api/mock/environments/active', async (req) => ({ activeEnvironmentId: setActiveEnvironment(req.body?.id || null) }));

  // ---- sending a request (see sender.js for why this runs server-side) ----
  fastify.post('/api/mock/send', async (req, reply) => {
    const { method, url, headers, body } = req.body || {};
    if (!url) return reply.code(400).send({ error: 'url required' });
    try {
      new URL(url);
    } catch {
      return reply.code(400).send({ error: `Invalid URL: ${url}` });
    }
    return sendHttpRequest({ method: method || 'GET', url, headers, body });
  });

  // ---- mock servers ----
  fastify.get('/api/mock/servers', async () => ({
    servers: listMockServers().map((s) => ({ ...s, ...mockServerStatus(s.id) })),
  }));

  fastify.post('/api/mock/servers', async (req, reply) => {
    if (!req.body?.name) return reply.code(400).send({ error: 'name required' });
    return createMockServer(req.body.name, req.body.port);
  });

  fastify.put('/api/mock/servers/:id', async (req, reply) => {
    const updated = updateMockServer(req.params.id, req.body || {});
    if (!updated) return reply.code(404).send({ error: 'Mock server not found' });
    return updated;
  });

  fastify.delete('/api/mock/servers/:id', async (req) => {
    stopMockServer(req.params.id);
    deleteMockServer(req.params.id);
    return { ok: true };
  });

  fastify.post('/api/mock/servers/:id/routes', async (req, reply) => {
    const route = createMockRoute(req.params.id, req.body || {});
    if (!route) return reply.code(404).send({ error: 'Mock server not found' });
    return route;
  });

  fastify.put('/api/mock/servers/:id/routes/:routeId', async (req, reply) => {
    const updated = updateMockRoute(req.params.id, req.params.routeId, req.body || {});
    if (!updated) return reply.code(404).send({ error: 'Route not found' });
    return updated;
  });

  fastify.delete('/api/mock/servers/:id/routes/:routeId', async (req) => {
    deleteMockRoute(req.params.id, req.params.routeId);
    return { ok: true };
  });

  fastify.post('/api/mock/servers/:id/start', async (req, reply) => {
    const result = await startMockServer(req.params.id);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ...result, ...mockServerStatus(req.params.id) };
  });

  fastify.post('/api/mock/servers/:id/stop', async (req) => {
    const result = stopMockServer(req.params.id);
    return { ...result, ...mockServerStatus(req.params.id) };
  });

  // Polled (not SSE) — traffic volume on a dev-tool mock server is low
  // enough that a client polling every couple seconds while this screen is
  // open is simpler than a second streaming transport alongside Log Lens's.
  fastify.get('/api/mock/servers/:id/traffic', async (req) => ({
    ...mockServerStatus(req.params.id),
    hits: mockServerTraffic(req.params.id),
  }));
}
