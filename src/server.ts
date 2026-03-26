import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { authMiddleware } from '@urule/auth-middleware';
import { ApprovalManager } from './services/approval-manager.js';
import { ApprovalRouter } from './services/approval-router.js';
import { registerApprovalRoutes } from './routes/approvals.routes.js';

export async function buildServer() {
  const app = Fastify({ logger: true });

  // Register CORS
  const allowedOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000').split(',');
  await app.register(cors, { origin: allowedOrigins });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Auth middleware
  await app.register(authMiddleware, { publicRoutes: ['/healthz'] });

  const manager = new ApprovalManager();
  const router = new ApprovalRouter();

  app.get('/healthz', async () => ({ status: 'ok' }));

  registerApprovalRoutes(app, manager, router);

  return app;
}
