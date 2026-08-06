import { browseDirectory } from '../../shared/fileBrowser.js';

export default async function browseRoutes(fastify) {
  fastify.get('/api/browse', async (req, reply) => {
    const { dir, showHidden } = req.query;
    try {
      return await browseDirectory(dir, showHidden === 'true');
    } catch (e) {
      return reply.code(400).send({ error: e.message, dir });
    }
  });
}
