import {
  allTabs, createTab, createApiTab, getTab, closeTab, activateTab, openFileForTab,
  configureApiTab, fetchApiTab, tabSummary, getActiveTabId,
} from '../tabs/registry.js';
import { environmentUrl } from '../settings.js';

export default async function tabRoutes(fastify) {
  fastify.get('/api/tabs', async () => ({
    tabs: allTabs().map(tabSummary),
    activeTabId: getActiveTabId(),
  }));

  fastify.post('/api/tabs', async (req, reply) => {
    const body = req.body || {};
    if (body.kind === 'api') {
      if (!environmentUrl(body.environment)) {
        return reply.code(400).send({ error: 'invalid environment' });
      }
      const tab = createApiTab(body.environment, body.queryConfig || {});
      return tabSummary(tab);
    }
    const inputPath = typeof body.path === 'string' && body.path.trim() ? body.path.trim() : null;
    const tab = createTab(inputPath);
    return tabSummary(tab);
  });

  fastify.post('/api/tabs/:id/open', async (req, reply) => {
    const tab = getTab(req.params.id);
    if (!tab) return reply.code(404).send({ error: 'no such tab' });
    const body = req.body || {};
    if (typeof body.path !== 'string' || !body.path.trim()) {
      return reply.code(400).send({ error: 'path is required' });
    }
    openFileForTab(tab, body.path.trim());
    return tabSummary(tab);
  });

  fastify.post('/api/tabs/:id/query', async (req, reply) => {
    const tab = getTab(req.params.id);
    if (!tab) return reply.code(404).send({ error: 'no such tab' });
    const body = req.body || {};
    if (!environmentUrl(body.environment)) {
      return reply.code(400).send({ error: 'invalid environment' });
    }
    configureApiTab(tab, body.environment, body.queryConfig || {});
    return tabSummary(tab);
  });

  fastify.post('/api/tabs/:id/fetch', async (req, reply) => {
    const tab = getTab(req.params.id);
    if (!tab) return reply.code(404).send({ error: 'no such tab' });
    if (tab.kind !== 'api') return reply.code(400).send({ error: 'not an api tab' });
    try {
      return await fetchApiTab(tab);
    } catch (e) {
      return reply.code(502).send({ error: e.message });
    }
  });

  fastify.post('/api/tabs/:id/activate', async (req, reply) => {
    const tab = getTab(req.params.id);
    if (!tab) return reply.code(404).send({ error: 'no such tab' });
    activateTab(tab.id);
    return { ok: true };
  });

  fastify.get('/api/tabs/:id/history', async (req, reply) => {
    const tab = getTab(req.params.id);
    if (!tab) return reply.code(404).send({ error: 'no such tab' });
    return {
      lines: tab.buffer,
      file: tab.resolvedPath,
      status: tab.status,
      kind: tab.kind,
      environment: tab.environment,
      queryConfig: tab.queryConfig,
      fetchError: tab.fetchError,
    };
  });

  fastify.post('/api/tabs/:id/clear', async (req, reply) => {
    const tab = getTab(req.params.id);
    if (!tab) return reply.code(404).send({ error: 'no such tab' });
    tab.buffer = [];
    return { ok: true };
  });

  fastify.delete('/api/tabs/:id', async (req, reply) => {
    const tab = getTab(req.params.id);
    if (!tab) return reply.code(404).send({ error: 'no such tab' });
    closeTab(tab.id);
    return { ok: true };
  });
}
