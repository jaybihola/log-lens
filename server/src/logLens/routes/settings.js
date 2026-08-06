import { getSettings, setSettings } from '../settings.js';
import { persistTabs } from '../tabs/registry.js';

export default async function settingsRoutes(fastify) {
  fastify.get('/api/settings', async () => getSettings());

  fastify.post('/api/settings', async (req) => {
    const next = setSettings(req.body || {});
    persistTabs();
    return next;
  });
}
