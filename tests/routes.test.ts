import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { resetRequestIdGenerator } from '../src/services/request-id-generator.js';

function baseBody() {
  return {
    runId: 'run-1',
    workspaceId: 'ws-1',
    agentId: 'agent-1',
    action: 'deploy',
    reason: 'Deploy new version',
  };
}

describe('Approval Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resetRequestIdGenerator();
    app = await buildServer();
    await app.ready();
  });

  it('POST /reject should deny the approval', async () => {
    // Create an approval
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/approvals',
      payload: baseBody(),
    });
    const created = createRes.json();

    // Reject it
    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${created.id}/reject`,
      payload: { decidedBy: 'user-1', note: 'Not appropriate' },
    });

    expect(rejectRes.statusCode).toBe(200);
    const rejected = rejectRes.json();
    expect(rejected.status).toBe('denied');
    expect(rejected.decidedBy).toBe('user-1');
    expect(rejected.decision).toBe('denied');
    expect(rejected.decisionNote).toBe('Not appropriate');
  });

  it('POST /reject should return 400 for non-pending approval', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/approvals',
      payload: baseBody(),
    });
    const created = createRes.json();

    // Approve first
    await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${created.id}/approve`,
      payload: { decidedBy: 'user-1' },
    });

    // Try to reject
    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${created.id}/reject`,
      payload: { decidedBy: 'user-2' },
    });

    expect(rejectRes.statusCode).toBe(400);
    expect(rejectRes.json().error).toContain('is not pending');
  });

  it('POST /request-changes should set changes_requested status', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/approvals',
      payload: baseBody(),
    });
    const created = createRes.json();

    const changesRes = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${created.id}/request-changes`,
      payload: { decidedBy: 'user-1', note: 'Need more context' },
    });

    expect(changesRes.statusCode).toBe(200);
    const changed = changesRes.json();
    expect(changed.status).toBe('changes_requested');
    expect(changed.decidedBy).toBe('user-1');
    expect(changed.decision).toBe('changes_requested');
    expect(changed.decisionNote).toBe('Need more context');
  });

  it('POST /request-changes should return 400 for already decided approval', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/approvals',
      payload: baseBody(),
    });
    const created = createRes.json();

    await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${created.id}/approve`,
      payload: { decidedBy: 'user-1' },
    });

    const changesRes = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${created.id}/request-changes`,
      payload: { decidedBy: 'user-2', note: 'Too late' },
    });

    expect(changesRes.statusCode).toBe(400);
    expect(changesRes.json().error).toContain('cannot have changes requested');
  });

  it('should create a rich approval via POST /api/v1/approvals', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/approvals',
      payload: {
        ...baseBody(),
        title: 'Production deployment',
        riskLevel: 'high',
        impactSummary: 'Affects 10k users',
        reasoningPoints: [
          { text: 'Tests pass', verified: true },
        ],
        proposedChanges: [
          { field: 'version', from: '1.0', to: '2.0', description: 'Major version bump' },
        ],
        accessPermissions: [
          { tool: 'kubectl', description: 'K8s access', warningLevel: 'warn' },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('Production deployment');
    expect(body.riskLevel).toBe('high');
    expect(body.impactSummary).toBe('Affects 10k users');
    expect(body.reasoningPoints).toHaveLength(1);
    expect(body.reasoningPoints[0].text).toBe('Tests pass');
    expect(body.proposedChanges).toHaveLength(1);
    expect(body.proposedChanges[0].field).toBe('version');
    expect(body.accessPermissions).toHaveLength(1);
    expect(body.accessPermissions[0].tool).toBe('kubectl');
    expect(body.requestId).toMatch(/^REQ-\d{8}-\d{3}$/);
    expect(body.auditTrail).toHaveLength(1);
    expect(body.auditTrail[0].label).toBe('Request created');
  });

  it('should include audit trail entries across state transitions via routes', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/approvals',
      payload: baseBody(),
    });
    const created = createRes.json();

    // Escalate
    const escalateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${created.id}/escalate`,
      payload: { escalateTo: ['manager-1'] },
    });
    const escalated = escalateRes.json();
    expect(escalated.auditTrail).toHaveLength(2);

    // Request changes
    const changesRes = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${created.id}/request-changes`,
      payload: { decidedBy: 'manager-1', note: 'Needs review' },
    });
    const changed = changesRes.json();
    expect(changed.auditTrail).toHaveLength(3);
    expect(changed.auditTrail[0].label).toBe('Request created');
    expect(changed.auditTrail[1].label).toBe('Escalated');
    expect(changed.auditTrail[2].label).toBe('Changes requested');
  });
});
