import fs from 'node:fs/promises';
import { browseDirectory } from '../fileBrowser.js';
import {
  listRoots, addRoot, removeRoot,
  listScratches, createScratch, readScratch, updateScratch, deleteScratch,
} from '../jsonLens/store.js';
import { readJsonFile, writeJsonFile, deleteJsonFile, renameJsonFile, fileExists } from '../jsonLens/files.js';

export default async function jsonLensRoutes(fastify) {
  // ---- open root folders ----
  fastify.get('/api/json-lens/roots', async () => ({ roots: listRoots() }));

  fastify.post('/api/json-lens/roots', async (req, reply) => {
    const dir = (req.body?.path || '').trim();
    if (!dir) return reply.code(400).send({ error: 'path required' });
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) return reply.code(400).send({ error: 'Not a directory' });
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
    return { roots: addRoot(dir) };
  });

  fastify.delete('/api/json-lens/roots', async (req) => ({ roots: removeRoot(req.body?.path) }));

  // ---- browsing (json-filtered — folders always shown so you can navigate
  // into them even if nothing directly inside matches yet) ----
  fastify.get('/api/json-lens/browse', async (req, reply) => {
    const { dir, showHidden } = req.query;
    try {
      return await browseDirectory(dir, showHidden === 'true', '.json');
    } catch (e) {
      return reply.code(400).send({ error: e.message, dir });
    }
  });

  // ---- reading/writing/deleting/renaming real files on disk ----
  fastify.get('/api/json-lens/file', async (req, reply) => {
    try {
      return await readJsonFile(req.query.path);
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  fastify.post('/api/json-lens/file', async (req, reply) => {
    const filePath = (req.body?.path || '').trim();
    if (!filePath) return reply.code(400).send({ error: 'path required' });
    try {
      return await writeJsonFile(filePath, req.body?.content ?? '');
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  fastify.get('/api/json-lens/file-exists', async (req, reply) => {
    try {
      return { exists: await fileExists(req.query.path) };
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  fastify.delete('/api/json-lens/file', async (req, reply) => {
    try {
      await deleteJsonFile(req.query.path);
      return { ok: true };
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  fastify.post('/api/json-lens/file/rename', async (req, reply) => {
    try {
      return await renameJsonFile(req.body?.from, req.body?.to);
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  // ---- scratches ----
  fastify.get('/api/json-lens/scratches', async () => ({ scratches: listScratches() }));

  fastify.post('/api/json-lens/scratches', async (req, reply) => {
    const name = (req.body?.name || 'Untitled').trim() || 'Untitled';
    try {
      return createScratch(name, req.body?.content ?? '');
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
  });

  fastify.get('/api/json-lens/scratches/:id', async (req, reply) => {
    try {
      return { content: readScratch(req.params.id) };
    } catch {
      return reply.code(404).send({ error: 'Scratch not found' });
    }
  });

  fastify.put('/api/json-lens/scratches/:id', async (req, reply) => {
    const updated = updateScratch(req.params.id, req.body || {});
    if (!updated) return reply.code(404).send({ error: 'Scratch not found' });
    return updated;
  });

  fastify.delete('/api/json-lens/scratches/:id', async (req) => {
    deleteScratch(req.params.id);
    return { ok: true };
  });
}
