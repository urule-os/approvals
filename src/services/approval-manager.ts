import { ulid } from 'ulid';
import type {
  ApprovalRequest,
  ApprovalDecision,
  ApprovalStatus,
  CreateApprovalParams,
  CreateRichApprovalParams,
  AuditTrailEntry,
} from '../types.js';
import { generateRequestId } from './request-id-generator.js';

function isRichParams(
  params: CreateApprovalParams | CreateRichApprovalParams,
): params is CreateRichApprovalParams {
  return (
    'title' in params ||
    'reasoningPoints' in params ||
    'proposedChanges' in params ||
    'riskLevel' in params ||
    'impactSummary' in params ||
    'accessPermissions' in params ||
    'governanceDecision' in params
  );
}

export class ApprovalManager {
  private approvals = new Map<string, ApprovalRequest>();

  create(params: CreateApprovalParams | CreateRichApprovalParams): ApprovalRequest {
    const now = new Date().toISOString();
    const approval: ApprovalRequest = {
      id: ulid(),
      requestId: generateRequestId(),
      runId: params.runId,
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      action: params.action,
      reason: params.reason,
      context: params.context ?? {},
      priority: params.priority ?? 'medium',
      status: 'pending',
      requestedBy: params.agentId,
      assignedTo: params.assignedTo ?? [],
      expiresAt: params.expiresInMs
        ? new Date(Date.now() + params.expiresInMs).toISOString()
        : undefined,
      createdAt: now,
      updatedAt: now,
      auditTrail: [
        {
          label: 'Request created',
          detail: `Approval requested by ${params.agentId}`,
          timestamp: now,
          status: 'done',
        },
      ],
    };

    if (isRichParams(params)) {
      approval.title = params.title;
      approval.reasoningPoints = params.reasoningPoints;
      approval.proposedChanges = params.proposedChanges;
      approval.riskLevel = params.riskLevel;
      approval.impactSummary = params.impactSummary;
      approval.accessPermissions = params.accessPermissions;
    }

    this.approvals.set(approval.id, approval);
    return approval;
  }

  approve(approvalId: string, decision: ApprovalDecision): ApprovalRequest {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    if (approval.status !== 'pending') {
      throw new Error(`Approval ${approvalId} is not pending (status: ${approval.status})`);
    }

    const now = new Date().toISOString();
    approval.status = 'approved';
    approval.decidedBy = decision.decidedBy;
    approval.decision = 'approved';
    approval.decisionNote = decision.note;
    approval.updatedAt = now;

    approval.auditTrail = approval.auditTrail ?? [];
    approval.auditTrail.push({
      label: 'Approved',
      detail: `${decision.decidedBy}${decision.note ? `: ${decision.note}` : ''}`,
      timestamp: now,
      status: 'done',
    });

    return approval;
  }

  deny(approvalId: string, decision: ApprovalDecision): ApprovalRequest {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    if (approval.status !== 'pending') {
      throw new Error(`Approval ${approvalId} is not pending (status: ${approval.status})`);
    }

    const now = new Date().toISOString();
    approval.status = 'denied';
    approval.decidedBy = decision.decidedBy;
    approval.decision = 'denied';
    approval.decisionNote = decision.note;
    approval.updatedAt = now;

    approval.auditTrail = approval.auditTrail ?? [];
    approval.auditTrail.push({
      label: 'Denied',
      detail: `${decision.decidedBy}${decision.note ? `: ${decision.note}` : ''}`,
      timestamp: now,
      status: 'done',
    });

    return approval;
  }

  escalate(approvalId: string, escalateTo: string[]): ApprovalRequest {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    if (approval.status !== 'pending') {
      throw new Error(`Approval ${approvalId} is not pending (status: ${approval.status})`);
    }

    const now = new Date().toISOString();
    approval.status = 'escalated';
    approval.assignedTo = escalateTo;
    approval.updatedAt = now;

    approval.auditTrail = approval.auditTrail ?? [];
    approval.auditTrail.push({
      label: 'Escalated',
      detail: `Escalated to ${escalateTo.join(', ')}`,
      timestamp: now,
      status: 'done',
    });

    return approval;
  }

  cancel(approvalId: string): ApprovalRequest {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    if (approval.status !== 'pending' && approval.status !== 'escalated') {
      throw new Error(`Approval ${approvalId} cannot be cancelled (status: ${approval.status})`);
    }

    const now = new Date().toISOString();
    approval.status = 'cancelled';
    approval.updatedAt = now;

    approval.auditTrail = approval.auditTrail ?? [];
    approval.auditTrail.push({
      label: 'Cancelled',
      detail: 'Approval cancelled',
      timestamp: now,
      status: 'done',
    });

    return approval;
  }

  requestChanges(approvalId: string, decidedBy: string, note: string): ApprovalRequest {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    if (approval.status !== 'pending' && approval.status !== 'escalated') {
      throw new Error(
        `Approval ${approvalId} cannot have changes requested (status: ${approval.status})`,
      );
    }

    const now = new Date().toISOString();
    approval.status = 'changes_requested';
    approval.decidedBy = decidedBy;
    approval.decision = 'changes_requested';
    approval.decisionNote = note;
    approval.updatedAt = now;

    approval.auditTrail = approval.auditTrail ?? [];
    approval.auditTrail.push({
      label: 'Changes requested',
      detail: `${decidedBy}: ${note}`,
      timestamp: now,
      status: 'done',
    });

    return approval;
  }

  get(approvalId: string): ApprovalRequest | undefined {
    return this.approvals.get(approvalId);
  }

  listByRun(runId: string): ApprovalRequest[] {
    return Array.from(this.approvals.values()).filter((a) => a.runId === runId);
  }

  listAll(filters?: { status?: ApprovalStatus }): ApprovalRequest[] {
    const all = Array.from(this.approvals.values());
    if (filters?.status) return all.filter(a => a.status === filters.status);
    return all;
  }

  listByWorkspace(
    workspaceId: string,
    filters?: { status?: ApprovalStatus },
  ): ApprovalRequest[] {
    return Array.from(this.approvals.values()).filter((a) => {
      if (a.workspaceId !== workspaceId) return false;
      if (filters?.status && a.status !== filters.status) return false;
      return true;
    });
  }

  listPendingForUser(userId: string): ApprovalRequest[] {
    return Array.from(this.approvals.values()).filter(
      (a) => a.status === 'pending' && a.assignedTo.includes(userId),
    );
  }
}
