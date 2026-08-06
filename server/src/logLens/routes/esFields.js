import { environmentUrl, foldFilterByKey } from '../settings.js';
import { fetchFoldFieldValues, fetchIndexFields, buildSearchBody } from '../es/fieldCache.js';

export default async function esFieldRoutes(fastify) {
  // The exact request body a fetch would send, built from the current form
  // state (fold filters, date range, KQL) — powers the "raw request" preview
  // editor. Errors (e.g. a bad KQL string) surface as 200s with a message
  // rather than a hard failure, since this is called on every form edit.
  fastify.post('/api/es-query-preview', async (req) => {
    const body = req.body || {};
    if (!environmentUrl(body.environment)) return { error: 'invalid environment' };
    try {
      return { body: buildSearchBody(body.environment, body.queryConfig || {}) };
    } catch (e) {
      return { error: e.message };
    }
  });

  fastify.get('/api/es-field-values', async (req, reply) => {
    const { environment, field, index } = req.query;
    if (!environmentUrl(environment) || !index || !foldFilterByKey(environment, index, field)) {
      return reply.code(400).send({ error: 'invalid environment, index, or field' });
    }
    try {
      const values = await fetchFoldFieldValues(environment, index, field);
      return { values };
    } catch (e) {
      return reply.code(502).send({ error: e.message });
    }
  });

  fastify.get('/api/index-fields', async (req, reply) => {
    const { environment, index } = req.query;
    if (!environmentUrl(environment) || !index) {
      return reply.code(400).send({ error: 'invalid environment or index' });
    }
    try {
      const fields = await fetchIndexFields(environment, index);
      return { fields };
    } catch (e) {
      return reply.code(502).send({ error: e.message });
    }
  });
}
