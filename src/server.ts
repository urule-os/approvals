import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ApprovalManager } from './services/approval-manager.js';
import { ApprovalRouter } from './services/approval-router.js';
import { registerApprovalRoutes } from './routes/approvals.routes.js';

export async function buildServer() {
  const app = Fastify({ logger: true });

  // Register CORS
  await app.register(cors, { origin: true });

  const manager = new ApprovalManager();
  const router = new ApprovalRouter();

  app.get('/healthz', async () => ({ status: 'ok' }));

  registerApprovalRoutes(app, manager, router);

  return app;
}
