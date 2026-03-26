import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authMiddleware } from '@urule/auth-middleware';
import { ApprovalManager } from './services/approval-manager.js';
import { ApprovalRouter } from './services/approval-router.js';
import { registerApprovalRoutes } from './routes/approvals.routes.js';

export async function buildServer() {
  const app = Fastify({ logger: true });

  // Register CORS
  await app.register(cors, { origin: true });

  // Auth middleware
  await app.register(authMiddleware, { publicRoutes: ['/healthz'] });

  const manager = new ApprovalManager();
  const router = new ApprovalRouter();

  app.get('/healthz', async () => ({ status: 'ok' }));

  registerApprovalRoutes(app, manager, router);

  return app;
}
