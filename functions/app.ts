import { corsMiddleware } from './middleware/cors';
import { authRoutes } from './routes/auth';
import { proxyRoutes } from './routes/proxy';
import { updateRoutes } from './routes/update';
import { musicRoutes } from './routes/music';
import { syncRoutes } from './routes/sync';
import { syncRoutesV2 } from './routes/sync-v2';
import { podcastRoutes } from './routes/api';

import { Hono } from 'hono';
import type { Env } from './types/hono';

export const app = new Hono<{
  Bindings: Env;
}>();

// Global Middleware
app.use('*', async (c, next) => {
  console.log(`[Hono] ${c.req.method} ${c.req.path}`);
  await next();
});
app.use('*', corsMiddleware);

app.get('/health', (c) => c.text('OK'));


// Routes
app.route('/auth', authRoutes);

app.route('/proxy', proxyRoutes);
app.route('/update', updateRoutes);
app.route('/music-api', musicRoutes);
app.route('/sync', syncRoutes);
app.route('/sync/v2', syncRoutesV2)
app.route('/podcast-api', podcastRoutes);

// Export AppType for RPC
export type AppType = typeof app;
