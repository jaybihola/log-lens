import {
  listScratches, createScratch, readScratch, updateScratch, deleteScratch,
} from './store.js';

// Mirrors jsonLens/routes.js's scratch routes exactly, except GET .../:id
// returns the full { leftText, rightText, language, options } object
// directly rather than a { content } wrapper — a diff scratch's payload is
// already a small object, not a single string.
export default async function diffLensRoutes(fastify) {
  fastify.get('/api/diff-lens/scratches', async () => ({ scratches: listScratches() }));

  fastify.post('/api/diff-lens/scratches', async (req, reply) => {
    const name = (req.body?.name || 'Untitled').trim() || 'Untitled';
    try {
      const { leftText, rightText, language, options } = req.body || {};
      return createScratch(name, { leftText, rightText, language, options });
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  fastify.get('/api/diff-lens/scratches/:id', async (req, reply) => {
    try {
      return readScratch(req.params.id);
    } catch {
      return reply.code(404).send({ error: 'Scratch not found' });
    }
  });

  fastify.put('/api/diff-lens/scratches/:id', async (req, reply) => {
    const updated = updateScratch(req.params.id, req.body || {});
    if (!updated) return reply.code(404).send({ error: 'Scratch not found' });
    return updated;
  });

  fastify.delete('/api/diff-lens/scratches/:id', async (req) => {
    deleteScratch(req.params.id);
    return { ok: true };
  });
}
