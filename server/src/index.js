import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { ENV_FILE, config } from './config.js';
import { restoreFromState, createTab, allTabs } from './logLens/tabs/registry.js';
import tabRoutes from './logLens/routes/tabs.js';
import browseRoutes from './logLens/routes/browse.js';
import eventRoutes from './logLens/routes/events.js';
import settingsRoutes from './logLens/routes/settings.js';
import credentialsRoutes from './logLens/routes/credentials.js';
import esFieldRoutes from './logLens/routes/esFields.js';
import jsonLensRoutes from './jsonLens/routes.js';
import diffLensRoutes from './diffLens/routes.js';

dotenv.config({ path: ENV_FILE, quiet: true });

const fastify = Fastify({ logger: false });

await fastify.register(cors, { origin: true });
await fastify.register(tabRoutes);
await fastify.register(browseRoutes);
await fastify.register(eventRoutes);
await fastify.register(settingsRoutes);
await fastify.register(credentialsRoutes);
await fastify.register(esFieldRoutes);
await fastify.register(jsonLensRoutes);
await fastify.register(diffLensRoutes);

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
