import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalManager } from '../src/services/approval-manager.js';
import { resetRequestIdGenerator } from '../src/services/request-id-generator.js';
import type { CreateApprovalParams, CreateRichApprovalParams } from '../src/types.js';

function makeParams(overrides?: Partial<CreateApprovalParams>): CreateApprovalParams {
  return {
    runId: 'run-1',
    workspaceId: 'ws-1',
    agentId: 'agent-1',
    action: 'send-email',
    reason: 'Agent wants to send an email',
    ...overrides,
  };
}

function makeRichParams(overrides?: Partial<CreateRichApprovalParams>): CreateRichApprovalParams {
  return {
    ...makeParams(),
    title: 'Deploy to production',
    reasoningPoints: [
      { text: 'All tests pass', verified: true },
      { text: 'Reviewed by team lead', verified: false },
    ],
    proposedChanges: [
      { field: 'version', from: '1.0.0', to: '1.1.0', description: 'Bump version' },
    ],
    riskLevel: 'high',
    impactSummary: 'Affects all production users',
    accessPermissions: [
      { tool: 'deploy-cli', description: 'Deploy to production cluster', warningLevel: 'warn' },
      { tool: 'slack-notify', description: 'Send notification to #releases', warningLevel: 'ok' },
    ],
    ...overrides,
  };
}

describe('ApprovalManager', () => {
  let manager: ApprovalManager;

  beforeEach(() => {
    manager = new ApprovalManager();
    resetRequestIdGenerator();
  });

  it('should create an approval request', () => {
    const approval = manager.create(makeParams());

    expect(approval.id).toBeDefined();
    expect(approval.runId).toBe('run-1');
    expect(approval.workspaceId).toBe('ws-1');
    expect(approval.agentId).toBe('agent-1');
    expect(approval.action).toBe('send-email');
    expect(approval.reason).toBe('Agent wants to send an email');
    expect(approval.status).toBe('pending');
    expect(approval.priority).toBe('medium');
    expect(approval.context).toEqual({});
    expect(approval.createdAt).toBeDefined();
    expect(approval.updatedAt).toBeDefined();
  });

  it('should create with custom priority and assignees', () => {
    const approval = manager.create(
      makeParams({
        priority: 'critical',
        assignedTo: ['user-1', 'user-2'],
      }),
    );

    expect(approval.priority).toBe('critical');
    expect(approval.assignedTo).toEqual(['user-1', 'user-2']);
  });

  it('should create with expiration', () => {
    const approval = manager.create(
      makeParams({ expiresInMs: 60_000 }),
    );

    expect(approval.expiresAt).toBeDefined();
  });

  it('should approve a pending approval', () => {
    const approval = manager.create(makeParams());
    const approved = manager.approve(approval.id, {
      status: 'approved',
      decidedBy: 'user-1',
      note: 'Looks good',
    });

    expect(approved.status).toBe('approved');
    expect(approved.decidedBy).toBe('user-1');
    expect(approved.decision).toBe('approved');
    expect(approved.decisionNote).toBe('Looks good');
  });

  it('should throw when approving non-existent approval', () => {
    expect(() =>
      manager.approve('nonexistent', { status: 'approved', decidedBy: 'user-1' }),
    ).toThrow('Approval not found');
  });

  it('should throw when approving non-pending approval', () => {
    const approval = manager.create(makeParams());
    manager.approve(approval.id, { status: 'approved', decidedBy: 'user-1' });

    expect(() =>
      manager.approve(approval.id, { status: 'approved', decidedBy: 'user-2' }),
    ).toThrow('is not pending');
  });

  it('should deny a pending approval', () => {
    const approval = manager.create(makeParams());
    const denied = manager.deny(approval.id, {
      status: 'denied',
      decidedBy: 'user-1',
      note: 'Too risky',
    });

    expect(denied.status).toBe('denied');
    expect(denied.decidedBy).toBe('user-1');
    expect(denied.decision).toBe('denied');
    expect(denied.decisionNote).toBe('Too risky');
  });

  it('should throw when denying non-pending approval', () => {
    const approval = manager.create(makeParams());
    manager.deny(approval.id, { status: 'denied', decidedBy: 'user-1' });

    expect(() =>
      manager.deny(approval.id, { status: 'denied', decidedBy: 'user-2' }),
    ).toThrow('is not pending');
  });

  it('should escalate a pending approval', () => {
    const approval = manager.create(makeParams({ assignedTo: ['user-1'] }));
    const escalated = manager.escalate(approval.id, ['manager-1', 'manager-2']);

    expect(escalated.status).toBe('escalated');
    expect(escalated.assignedTo).toEqual(['manager-1', 'manager-2']);
  });

  it('should throw when escalating non-pending approval', () => {
    const approval = manager.create(makeParams());
    manager.approve(approval.id, { status: 'approved', decidedBy: 'user-1' });

    expect(() => manager.escalate(approval.id, ['manager-1'])).toThrow('is not pending');
  });

  it('should cancel a pending approval', () => {
    const approval = manager.create(makeParams());
    const cancelled = manager.cancel(approval.id);

    expect(cancelled.status).toBe('cancelled');
  });

  it('should cancel an escalated approval', () => {
    const approval = manager.create(makeParams());
    manager.escalate(approval.id, ['manager-1']);
    const cancelled = manager.cancel(approval.id);

    expect(cancelled.status).toBe('cancelled');
  });

  it('should throw when cancelling already decided approval', () => {
    const approval = manager.create(makeParams());
    manager.approve(approval.id, { status: 'approved', decidedBy: 'user-1' });

    expect(() => manager.cancel(approval.id)).toThrow('cannot be cancelled');
  });

  it('should get an approval by ID', () => {
    const approval = manager.create(makeParams());
    const fetched = manager.get(approval.id);

    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(approval.id);
  });

  it('should return undefined for non-existent approval', () => {
    expect(manager.get('nonexistent')).toBeUndefined();
  });

  it('should list approvals by run', () => {
    manager.create(makeParams({ runId: 'run-1' }));
    manager.create(makeParams({ runId: 'run-1' }));
    manager.create(makeParams({ runId: 'run-2' }));

    const run1Approvals = manager.listByRun('run-1');
    expect(run1Approvals).toHaveLength(2);

    const run2Approvals = manager.listByRun('run-2');
    expect(run2Approvals).toHaveLength(1);
  });

  it('should list approvals by workspace', () => {
    manager.create(makeParams({ workspaceId: 'ws-1' }));
    manager.create(makeParams({ workspaceId: 'ws-1' }));
    manager.create(makeParams({ workspaceId: 'ws-2' }));

    const ws1Approvals = manager.listByWorkspace('ws-1');
    expect(ws1Approvals).toHaveLength(2);
  });

  it('should list approvals by workspace with status filter', () => {
    const a1 = manager.create(makeParams({ workspaceId: 'ws-1' }));
    manager.create(makeParams({ workspaceId: 'ws-1' }));
    manager.approve(a1.id, { status: 'approved', decidedBy: 'user-1' });

    const pending = manager.listByWorkspace('ws-1', { status: 'pending' });
    expect(pending).toHaveLength(1);

    const approved = manager.listByWorkspace('ws-1', { status: 'approved' });
    expect(approved).toHaveLength(1);
  });

  it('should list pending approvals for user', () => {
    manager.create(makeParams({ assignedTo: ['user-1', 'user-2'] }));
    manager.create(makeParams({ assignedTo: ['user-2', 'user-3'] }));
    manager.create(makeParams({ assignedTo: ['user-3'] }));

    const user1Pending = manager.listPendingForUser('user-1');
    expect(user1Pending).toHaveLength(1);

    const user2Pending = manager.listPendingForUser('user-2');
    expect(user2Pending).toHaveLength(2);

    const user3Pending = manager.listPendingForUser('user-3');
    expect(user3Pending).toHaveLength(2);
  });

  it('should not list non-pending approvals for user', () => {
    const a1 = manager.create(makeParams({ assignedTo: ['user-1'] }));
    manager.approve(a1.id, { status: 'approved', decidedBy: 'user-1' });

    const pending = manager.listPendingForUser('user-1');
    expect(pending).toHaveLength(0);
  });

  // --- Rich approval tests ---

  it('should create a rich approval with all fields', () => {
    const approval = manager.create(makeRichParams());

    expect(approval.title).toBe('Deploy to production');
    expect(approval.reasoningPoints).toHaveLength(2);
    expect(approval.reasoningPoints![0]).toEqual({ text: 'All tests pass', verified: true });
    expect(approval.reasoningPoints![1]).toEqual({ text: 'Reviewed by team lead', verified: false });
    expect(approval.proposedChanges).toHaveLength(1);
    expect(approval.proposedChanges![0].field).toBe('version');
    expect(approval.proposedChanges![0].from).toBe('1.0.0');
    expect(approval.proposedChanges![0].to).toBe('1.1.0');
    expect(approval.riskLevel).toBe('high');
    expect(approval.impactSummary).toBe('Affects all production users');
    expect(approval.accessPermissions).toHaveLength(2);
    expect(approval.accessPermissions![0].warningLevel).toBe('warn');
    expect(approval.accessPermissions![1].warningLevel).toBe('ok');
  });

  it('should generate requestId automatically', () => {
    const a1 = manager.create(makeParams());
    const a2 = manager.create(makeParams());

    expect(a1.requestId).toMatch(/^REQ-\d{8}-001$/);
    expect(a2.requestId).toMatch(/^REQ-\d{8}-002$/);
  });

  it('should initialize auditTrail on creation', () => {
    const approval = manager.create(makeParams());

    expect(approval.auditTrail).toBeDefined();
    expect(approval.auditTrail).toHaveLength(1);
    expect(approval.auditTrail![0].label).toBe('Request created');
    expect(approval.auditTrail![0].detail).toContain('agent-1');
    expect(approval.auditTrail![0].status).toBe('done');
    expect(approval.auditTrail![0].timestamp).toBeDefined();
  });

  it('should accumulate auditTrail on approve', () => {
    const approval = manager.create(makeParams());
    const approved = manager.approve(approval.id, {
      status: 'approved',
      decidedBy: 'user-1',
      note: 'LGTM',
    });

    expect(approved.auditTrail).toHaveLength(2);
    expect(approved.auditTrail![1].label).toBe('Approved');
    expect(approved.auditTrail![1].detail).toContain('user-1');
    expect(approved.auditTrail![1].detail).toContain('LGTM');
  });

  it('should accumulate auditTrail on deny', () => {
    const approval = manager.create(makeParams());
    const denied = manager.deny(approval.id, {
      status: 'denied',
      decidedBy: 'user-1',
      note: 'Not ready',
    });

    expect(denied.auditTrail).toHaveLength(2);
    expect(denied.auditTrail![1].label).toBe('Denied');
    expect(denied.auditTrail![1].detail).toContain('user-1');
  });

  it('should accumulate auditTrail on escalate', () => {
    const approval = manager.create(makeParams());
    const escalated = manager.escalate(approval.id, ['manager-1']);

    expect(escalated.auditTrail).toHaveLength(2);
    expect(escalated.auditTrail![1].label).toBe('Escalated');
    expect(escalated.auditTrail![1].detail).toContain('manager-1');
  });

  it('should accumulate auditTrail on cancel', () => {
    const approval = manager.create(makeParams());
    const cancelled = manager.cancel(approval.id);

    expect(cancelled.auditTrail).toHaveLength(2);
    expect(cancelled.auditTrail![1].label).toBe('Cancelled');
  });

  it('should accumulate auditTrail on requestChanges', () => {
    const approval = manager.create(makeParams());
    const changed = manager.requestChanges(approval.id, 'user-1', 'Needs more tests');

    expect(changed.auditTrail).toHaveLength(2);
    expect(changed.auditTrail![1].label).toBe('Changes requested');
    expect(changed.auditTrail![1].detail).toContain('user-1');
    expect(changed.auditTrail![1].detail).toContain('Needs more tests');
  });

  it('should set correct status and fields on requestChanges', () => {
    const approval = manager.create(makeParams());
    const changed = manager.requestChanges(approval.id, 'user-1', 'Needs more tests');

    expect(changed.status).toBe('changes_requested');
    expect(changed.decidedBy).toBe('user-1');
    expect(changed.decision).toBe('changes_requested');
    expect(changed.decisionNote).toBe('Needs more tests');
  });

  it('should allow requestChanges on escalated approval', () => {
    const approval = manager.create(makeParams());
    manager.escalate(approval.id, ['manager-1']);
    const changed = manager.requestChanges(approval.id, 'manager-1', 'Fix the config');

    expect(changed.status).toBe('changes_requested');
    expect(changed.auditTrail).toHaveLength(3); // created + escalated + changes_requested
  });

  it('should throw requestChanges for non-pending/non-escalated approval', () => {
    const approval = manager.create(makeParams());
    manager.approve(approval.id, { status: 'approved', decidedBy: 'user-1' });

    expect(() =>
      manager.requestChanges(approval.id, 'user-2', 'Too late'),
    ).toThrow('cannot have changes requested');
  });

  it('should throw requestChanges for non-existent approval', () => {
    expect(() =>
      manager.requestChanges('nonexistent', 'user-1', 'Nope'),
    ).toThrow('Approval not found');
  });
});
