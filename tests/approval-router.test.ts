import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalRouter } from '../src/services/approval-router.js';

describe('ApprovalRouter', () => {
  let router: ApprovalRouter;

  beforeEach(() => {
    router = new ApprovalRouter();
  });

  it('should add a routing rule', () => {
    const rule = router.addRule({
      workspaceId: 'ws-1',
      pattern: 'email.*',
      assignTo: ['user-1'],
      priority: 'high',
      autoApprove: false,
    });

    expect(rule.id).toBeDefined();
    expect(rule.workspaceId).toBe('ws-1');
    expect(rule.pattern).toBe('email.*');
    expect(rule.assignTo).toEqual(['user-1']);
    expect(rule.priority).toBe('high');
    expect(rule.autoApprove).toBe(false);
  });

  it('should route with matching rule', () => {
    router.addRule({
      workspaceId: 'ws-1',
      pattern: 'email.*',
      assignTo: ['user-1', 'user-2'],
      priority: 'high',
      autoApprove: false,
    });

    const result = router.route('ws-1', 'email.send');
    expect(result.assignTo).toEqual(['user-1', 'user-2']);
    expect(result.priority).toBe('high');
    expect(result.autoApprove).toBe(false);
  });

  it('should return defaults when no matching rule', () => {
    router.addRule({
      workspaceId: 'ws-1',
      pattern: 'email.*',
      assignTo: ['user-1'],
      priority: 'high',
      autoApprove: false,
    });

    const result = router.route('ws-1', 'database.delete');
    expect(result.assignTo).toEqual([]);
    expect(result.priority).toBe('medium');
    expect(result.autoApprove).toBe(false);
  });

  it('should return defaults for unknown workspace', () => {
    router.addRule({
      workspaceId: 'ws-1',
      pattern: 'email.*',
      assignTo: ['user-1'],
      priority: 'high',
      autoApprove: false,
    });

    const result = router.route('ws-999', 'email.send');
    expect(result.assignTo).toEqual([]);
    expect(result.priority).toBe('medium');
    expect(result.autoApprove).toBe(false);
  });

  it('should match exact action', () => {
    router.addRule({
      workspaceId: 'ws-1',
      pattern: 'deploy',
      assignTo: ['admin-1'],
      priority: 'critical',
      autoApprove: false,
    });

    const match = router.route('ws-1', 'deploy');
    expect(match.assignTo).toEqual(['admin-1']);
    expect(match.priority).toBe('critical');

    const noMatch = router.route('ws-1', 'deploy.staging');
    expect(noMatch.assignTo).toEqual([]);
  });

  it('should remove a rule', () => {
    const rule = router.addRule({
      workspaceId: 'ws-1',
      pattern: 'email.*',
      assignTo: ['user-1'],
      priority: 'high',
      autoApprove: false,
    });

    expect(router.removeRule(rule.id)).toBe(true);

    const result = router.route('ws-1', 'email.send');
    expect(result.assignTo).toEqual([]);
  });

  it('should return false when removing non-existent rule', () => {
    expect(router.removeRule('nonexistent')).toBe(false);
  });

  it('should list rules by workspace', () => {
    router.addRule({
      workspaceId: 'ws-1',
      pattern: 'email.*',
      assignTo: ['user-1'],
      priority: 'high',
      autoApprove: false,
    });
    router.addRule({
      workspaceId: 'ws-1',
      pattern: 'deploy.*',
      assignTo: ['admin-1'],
      priority: 'critical',
      autoApprove: false,
    });
    router.addRule({
      workspaceId: 'ws-2',
      pattern: 'slack.*',
      assignTo: ['user-2'],
      priority: 'low',
      autoApprove: true,
    });

    const ws1Rules = router.listRules('ws-1');
    expect(ws1Rules).toHaveLength(2);

    const ws2Rules = router.listRules('ws-2');
    expect(ws2Rules).toHaveLength(1);
  });

  it('should handle auto-approve matching', () => {
    router.addRule({
      workspaceId: 'ws-1',
      pattern: 'log.*',
      assignTo: [],
      priority: 'low',
      autoApprove: true,
    });

    const result = router.route('ws-1', 'log.info');
    expect(result.autoApprove).toBe(true);
    expect(result.priority).toBe('low');
  });
});
