import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { authMiddleware } from '@urule/auth-middleware';
import { ApprovalManager } from './services/approval-manager.js';
import { ApprovalRouter } from './services/approval-router.js';
import { registerApprovalRoutes } from './routes/approvals.routes.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
          };
        },
      },
    },
    genReqId: () => crypto.randomUUID(),
  });

  // Register CORS
  const allowedOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000').split(',');
  await app.register(cors, { origin: allowedOrigins });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Auth middleware
  await app.register(authMiddleware, { publicRoutes: ['/healthz', '/docs'] });

  // OpenAPI documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Urule Approvals API',
        description: 'Temporal-backed approval workflow engine',
        version: '0.1.0',
      },
      servers: [{ url: 'http://localhost:3003' }],
      tags: [{ name: 'approvals' }, { name: 'rules' }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  const manager = new ApprovalManager();
  const router = new ApprovalRouter();

  app.get('/healthz', async () => ({ status: 'ok' }));

  registerApprovalRoutes(app, manager, router);

  return app;
}
