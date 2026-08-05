import { listCredentials, addCredential, updateCredential, removeCredential } from '../credentials.js';
import { persistTabs } from '../tabs/registry.js';

export default async function credentialsRoutes(fastify) {
  fastify.get('/api/credentials', async () => ({ credentials: listCredentials() }));

  fastify.post('/api/credentials', async (req, reply) => {
    const body = req.body || {};
    if (typeof body.username !== 'string' || !body.username.trim()) {
      return reply.code(400).send({ error: 'username is required' });
    }
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : body.username.trim();
    const id = addCredential(name, body.username.trim(), typeof body.password === 'string' ? body.password : '');
    persistTabs();
    return { id };
  });

  fastify.put('/api/credentials/:id', async (req, reply) => {
    const body = req.body || {};
    const ok = updateCredential(req.params.id, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      username: typeof body.username === 'string' ? body.username.trim() : undefined,
      password: body.password,
    });
    if (!ok) return reply.code(404).send({ error: 'no such credential' });
    persistTabs();
    return { ok: true };
  });

  fastify.delete('/api/credentials/:id', async (req, reply) => {
    removeCredential(req.params.id);
    persistTabs();
    return { ok: true };
  });
}
