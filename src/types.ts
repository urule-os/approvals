export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'escalated' | 'expired' | 'cancelled' | 'changes_requested';
export type ApprovalPriority = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ReasoningPoint {
  text: string;
  verified: boolean;
}

export interface ProposedChange {
  field: string;
  from?: unknown;
  to?: unknown;
  description: string;
}

export interface AccessPermission {
  tool: string;
  description: string;
  warningLevel: 'ok' | 'warn';
}

export interface AuditTrailEntry {
  label: string;
  detail: string;
  timestamp: string;
  status: 'done' | 'pending';
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  workspaceId: string;
  agentId: string;
  action: string;
  reason: string;
  context: Record<string, unknown>;
  priority: ApprovalPriority;
  status: ApprovalStatus;
  requestedBy: string;
  assignedTo: string[];
  decidedBy?: string;
  decision?: string;
  decisionNote?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  requestId?: string;
  reasoningPoints?: ReasoningPoint[];
  proposedChanges?: ProposedChange[];
  riskLevel?: RiskLevel;
  impactSummary?: string;
  accessPermissions?: AccessPermission[];
  auditTrail?: AuditTrailEntry[];
}

export interface CreateApprovalParams {
  runId: string;
  workspaceId: string;
  agentId: string;
  action: string;
  reason: string;
  context?: Record<string, unknown>;
  priority?: ApprovalPriority;
  assignedTo?: string[];
  expiresInMs?: number;
}

export interface CreateRichApprovalParams extends CreateApprovalParams {
  title?: string;
  reasoningPoints?: ReasoningPoint[];
  proposedChanges?: ProposedChange[];
  riskLevel?: RiskLevel;
  impactSummary?: string;
  accessPermissions?: AccessPermission[];
  governanceDecision?: Record<string, unknown>;
}

export interface ApprovalDecision {
  status: 'approved' | 'denied';
  decidedBy: string;
  note?: string;
}

export interface ApprovalRoutingRule {
  id: string;
  workspaceId: string;
  pattern: string;
  assignTo: string[];
  priority: ApprovalPriority;
  autoApprove: boolean;
}
