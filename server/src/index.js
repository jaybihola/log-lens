import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { ENV_FILE, config } from './config.js';
import { restoreFromState, createTab, allTabs } from './tabs/registry.js';
import tabRoutes from './routes/tabs.js';
import browseRoutes from './routes/browse.js';
import eventRoutes from './routes/events.js';
import settingsRoutes from './routes/settings.js';
import credentialsRoutes from './routes/credentials.js';
import esFieldRoutes from './routes/esFields.js';

dotenv.config({ path: ENV_FILE, quiet: true });

const fastify = Fastify({ logger: false });

await fastify.register(cors, { origin: true });
await fastify.register(tabRoutes);
await fastify.register(browseRoutes);
await fastify.register(eventRoutes);
await fastify.register(settingsRoutes);
await fastify.register(credentialsRoutes);
await fastify.register(esFieldRoutes);

fastify.get('/api/health', async () => ({ ok: true }));

restoreFromState();
if (config.initialPath && !allTabs().some((t) => t.resolvedPath === path.resolve(config.initialPath))) {
  createTab(config.initialPath);
}

fastify.listen({ port: config.port }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`[log-lens] server listening on http://localhost:${config.port}/`);
  if (!allTabs().length) console.log('[log-lens] no tabs open — pick a file from the browser');
});
