import type { FastifyInstance } from 'fastify';
import type { ApprovalStatus, CreateRichApprovalParams } from '../types.js';
import { ApprovalManager } from '../services/approval-manager.js';
import { ApprovalRouter } from '../services/approval-router.js';

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
    const body = request.body as {
      runId: string;
      workspaceId: string;
      agentId: string;
      action: string;
      reason: string;
      context?: Record<string, unknown>;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      assignedTo?: string[];
      expiresInMs?: number;
      // Rich fields
      title?: string;
      reasoningPoints?: CreateRichApprovalParams['reasoningPoints'];
      proposedChanges?: CreateRichApprovalParams['proposedChanges'];
      riskLevel?: CreateRichApprovalParams['riskLevel'];
      impactSummary?: string;
      accessPermissions?: CreateRichApprovalParams['accessPermissions'];
      governanceDecision?: Record<string, unknown>;
    };

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
    const body = request.body as { decidedBy: string; note?: string };
    try {
      const approval = manager.approve(approvalId, {
        status: 'approved',
        decidedBy: body.decidedBy,
        note: body.note,
      });
      return approval;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // Deny
  app.post('/api/v1/approvals/:approvalId/deny', async (request, reply) => {
    const { approvalId } = request.params as { approvalId: string };
    const body = request.body as { decidedBy: string; note?: string };
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

  // Reject (alias for deny)
  app.post('/api/v1/approvals/:approvalId/reject', async (request, reply) => {
    const { approvalId } = request.params as { approvalId: string };
    const body = request.body as { decidedBy: string; note?: string };
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
    const body = request.body as { decidedBy: string; note: string };
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
    const body = request.body as { escalateTo: string[] };
    try {
      const approval = manager.escalate(approvalId, body.escalateTo);
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
    const body = request.body as {
      workspaceId: string;
      pattern: string;
      assignTo: string[];
      priority: 'low' | 'medium' | 'high' | 'critical';
      autoApprove: boolean;
    };
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
