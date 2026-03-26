/**
 * Temporal Approval Workflow (Placeholder)
 *
 * This file will contain the Temporal workflow definition for managing
 * approval lifecycles. The workflow will:
 *
 * 1. Receive an approval request signal
 * 2. Wait for an approve/deny/escalate decision (with optional timeout)
 * 3. Signal the orchestrator run to resume when approved
 * 4. Handle expiration via Temporal timers
 *
 * For now, the actual approval logic is handled in-memory by ApprovalManager.
 * Temporal integration will be added when @temporalio/workflow and
 * @temporalio/client are properly configured in the deployment environment.
 *
 * Future workflow shape:
 *
 *   export async function approvalWorkflow(request: ApprovalRequest): Promise<ApprovalDecision> {
 *     // Set up expiration timer if expiresAt is set
 *     // Wait for signal: approve | deny | escalate | cancel
 *     // On decision, signal the orchestrator to resume the paused run
 *     // Return the decision
 *   }
 *
 *   export const approveSignal = defineSignal<[ApprovalDecision]>('approve');
 *   export const denySignal = defineSignal<[ApprovalDecision]>('deny');
 *   export const escalateSignal = defineSignal<[string[]]>('escalate');
 *   export const cancelSignal = defineSignal('cancel');
 */

export const WORKFLOW_NAME = 'approval-workflow';
export const TASK_QUEUE = 'urule-approvals';
