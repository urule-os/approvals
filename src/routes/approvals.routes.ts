import type { FastifyInstance } from 'fastify';
import type { ApprovalStatus, CreateRichApprovalParams } from '../types.js';
import { ApprovalManager } from '../services/approval-manager.js';
import { ApprovalRouter } from '../services/approval-router.js';
import { z } from 'zod';
import { AuditLogger } from '@urule/events';

const audit = new AuditLogger('approvals', (topic, data) => {
  console.log(JSON.stringify({ audit: true, topic, ...data as Record<string, unknown> }));
});

// -- Zod Schemas ------------------------------------------------------

const priorityEnum = z.enum(['low', 'medium', 'high', 'critical']);

const createApprovalSchema = z.object({
  runId: z.string(),
  workspaceId: z.string(),
  agentId: z.string(),
  action: z.string(),
  reason: z.string().min(1),
  context: z.object({}).passthrough().optional(),
  priority: priorityEnum.optional(),
  assignedTo: z.array(z.string()).optional(),
  expiresInMs: z.number().positive().optional(),
  title: z.string().optional(),
  reasoningPoints: z.array(z.any()).optional(),
  proposedChanges: z.array(z.any()).optional(),
  riskLevel: priorityEnum.optional(),
  impactSummary: z.string().optional(),
  accessPermissions: z.array(z.any()).optional(),
  governanceDecision: z.object({}).passthrough().optional(),
});

const approveOrDenySchema = z.object({
  decidedBy: z.string().min(1),
  note: z.string().optional(),
});

const requestChangesSchema = z.object({
  decidedBy: z.string().min(1),
  note: z.string().min(1),
});

const escalateSchema = z.object({
  escalateTo: z.array(z.string()).min(1),
});

const createRuleSchema = z.object({
  workspaceId: z.string(),
  pattern: z.string(),
  assignTo: z.array(z.string()),
  priority: priorityEnum,
  autoApprove: z.boolean(),
});

// -- Routes -----------------------------------------------------------

export function registerApprovalRoutes(
  app: FastifyInstance,
  manager: ApprovalManager,
  router: ApprovalRouter,
): void {
  // List all approvals (with optional status_filter query param)
  app.get<{ Querystring: { status_filter?: string } }>('/api/v1/approvals', async (request) => {
    const { status_filter } = request.query;
    return manager.listAll(status_filter ? { status: status_filter as ApprovalStatus } : undefined);
  });

  // Create approval request
  app.post('/api/v1/approvals', async (request, reply) => {
    const parsed = createApprovalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const body = parsed.data;

    // Use router to determine assignees and priority if not provided
    const routing = router.route(body.workspaceId, body.action);

    const approval = manager.create({
      runId: body.runId,
      workspaceId: body.workspaceId,
      agentId: body.agentId,
      action: body.action,
      reason: body.reason,
      context: body.context,
      priority: body.priority ?? routing.priority,
      assignedTo: body.assignedTo ?? routing.assignTo,
      expiresInMs: body.expiresInMs,
      // Rich fields
      title: body.title,
      reasoningPoints: body.reasoningPoints,
      proposedChanges: body.proposedChanges,
      riskLevel: body.riskLevel,
      impactSummary: body.impactSummary,
      accessPermissions: body.accessPermissions,
      governanceDecision: body.governanceDecision,
    });

    // If auto-approve, immediately approve
    if (routing.autoApprove && !body.assignedTo) {
      const approved = manager.approve(approval.id, {
        status: 'approved',
        decidedBy: 'system:auto-approve',
        note: 'Auto-approved by routing rule',
      });
      return reply.status(201).send(approved);
    }

    return reply.status(201).send(approval);
  });

  // Get approval by ID
  app.get('/api/v1/approvals/:approvalId', async (request, reply) => {
    const { approvalId } = request.params as { approvalId: string };
    const approval = manager.get(approvalId);
    if (!approval) {
      return reply.status(404).send({ error: 'Approval not found' });
    }
    return approval;
  });

  // Approve
  app.post('/api/v1/approvals/:approvalId/approve', async (request, reply) => {
    const { approvalId } = request.params as { approvalId: string };
    const parsed = approveOrDenySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const body = parsed.data;
    try {
      const approval = manager.approve(approvalId, {
        status: 'approved',
        decidedBy: body.decidedBy,
        note: body.note,
      });

      audit.approvalDecided(
        { id: body.decidedBy, username: body.decidedBy },
        approvalId, 'approved', `Approval "${approvalId}" approved by ${body.decidedBy}`,
        { metadata: { note: body.note } },
      ).catch(() => {});

      return approval;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // Deny
  app.post('/api/v1/approvals/:approvalId/deny', async (request, reply) => {
    const { approvalId } = request.params as { approvalId: string };
    const parsed = approveOrDenySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const body = parsed.data;
    try {
      const approval = manager.deny(approvalId, {
        status: 'denied',
        decidedBy: body.decidedBy,
        note: body.note,
      });

      audit.approvalDecided(
        { id: body.decidedBy, username: body.decidedBy },
        approvalId, 'denied', `Approval "${approvalId}" denied by ${body.decidedBy}`,
        { metadata: { note: body.note } },
      ).catch(() => {});

      return approval;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // Reject (alias for deny)
  app.post('/api/v1/approvals/:approvalId/reject', async (request, reply) => {
    const { approvalId } = request.params as { approvalId: string };
    const parsed = approveOrDenySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const body = parsed.data;
    try {
      const approval = manager.deny(approvalId, {
        status: 'denied',
        decidedBy: body.decidedBy,
        note: body.note,
      });
      return approval;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // Request changes
  app.post('/api/v1/approvals/:approvalId/request-changes', async (request, reply) => {
    const { approvalId } = request.params as { approvalId: string };
    const parsed = requestChangesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const body = parsed.data;
    try {
      const approval = manager.requestChanges(approvalId, body.decidedBy, body.note);
      return approval;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // Escalate
  app.post('/api/v1/approvals/:approvalId/escalate', async (request, reply) => {
    const { approvalId } = request.params as { approvalId: string };
    const parsed = escalateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const body = parsed.data;
    try {
      const approval = manager.escalate(approvalId, body.escalateTo);

      audit.approvalDecided(
        { id: 'system', username: 'system' },
        approvalId, 'escalated', `Approval "${approvalId}" escalated`,
        { metadata: { escalateTo: body.escalateTo } },
      ).catch(() => {});

      return approval;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // Cancel
  app.post('/api/v1/approvals/:approvalId/cancel', async (request, reply) => {
    const { approvalId } = request.params as { approvalId: string };
    try {
      const approval = manager.cancel(approvalId);
      return approval;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // List approvals by run
  app.get('/api/v1/runs/:runId/approvals', async (request) => {
    const { runId } = request.params as { runId: string };
    return manager.listByRun(runId);
  });

  // List approvals by workspace
  app.get('/api/v1/workspaces/:wsId/approvals', async (request) => {
    const { wsId } = request.params as { wsId: string };
    const query = request.query as { status?: ApprovalStatus };
    return manager.listByWorkspace(wsId, query.status ? { status: query.status } : undefined);
  });

  // List pending approvals for user
  app.get('/api/v1/users/:userId/approvals/pending', async (request) => {
    const { userId } = request.params as { userId: string };
    return manager.listPendingForUser(userId);
  });

  // Add routing rule
  app.post('/api/v1/approval-rules', async (request, reply) => {
    const parsed = createRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const body = parsed.data;
    const rule = router.addRule(body);
    return reply.status(201).send(rule);
  });

  // List rules for workspace
  app.get('/api/v1/workspaces/:wsId/approval-rules', async (request) => {
    const { wsId } = request.params as { wsId: string };
    return router.listRules(wsId);
  });

  // Remove rule
  app.delete('/api/v1/approval-rules/:ruleId', async (request, reply) => {
    const { ruleId } = request.params as { ruleId: string };
    const removed = router.removeRule(ruleId);
    if (!removed) {
      return reply.status(404).send({ error: 'Rule not found' });
    }
    return { success: true };
  });
}
