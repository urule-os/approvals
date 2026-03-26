import { ulid } from 'ulid';
import type { ApprovalPriority, ApprovalRoutingRule } from '../types.js';

export class ApprovalRouter {
  private rules = new Map<string, ApprovalRoutingRule>();

  addRule(rule: Omit<ApprovalRoutingRule, 'id'>): ApprovalRoutingRule {
    const fullRule: ApprovalRoutingRule = {
      ...rule,
      id: ulid(),
    };
    this.rules.set(fullRule.id, fullRule);
    return fullRule;
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  listRules(workspaceId: string): ApprovalRoutingRule[] {
    return Array.from(this.rules.values()).filter(
      (r) => r.workspaceId === workspaceId,
    );
  }

  route(
    workspaceId: string,
    action: string,
  ): { assignTo: string[]; priority: ApprovalPriority; autoApprove: boolean } {
    const workspaceRules = this.listRules(workspaceId);

    for (const rule of workspaceRules) {
      if (this.matchPattern(rule.pattern, action)) {
        return {
          assignTo: rule.assignTo,
          priority: rule.priority,
          autoApprove: rule.autoApprove,
        };
      }
    }

    // Default: no specific assignees, medium priority, no auto-approve
    return {
      assignTo: [],
      priority: 'medium',
      autoApprove: false,
    };
  }

  private matchPattern(pattern: string, action: string): boolean {
    // Simple glob matching using startsWith for prefix patterns
    if (pattern.endsWith('*')) {
      return action.startsWith(pattern.slice(0, -1));
    }
    return action === pattern;
  }
}
