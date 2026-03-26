import { describe, it, expect, beforeEach } from 'vitest';
import { generateRequestId, resetRequestIdGenerator } from '../src/services/request-id-generator.js';

describe('RequestIdGenerator', () => {
  beforeEach(() => {
    resetRequestIdGenerator();
  });

  it('should generate sequential IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    const id3 = generateRequestId();

    expect(id1).toMatch(/^REQ-\d{8}-001$/);
    expect(id2).toMatch(/^REQ-\d{8}-002$/);
    expect(id3).toMatch(/^REQ-\d{8}-003$/);
  });

  it('should include current date', () => {
    const id = generateRequestId();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    expect(id).toContain(today);
  });

  it('should reset counter', () => {
    generateRequestId();
    generateRequestId();
    resetRequestIdGenerator();
    const id = generateRequestId();
    expect(id).toMatch(/^REQ-\d{8}-001$/);
  });
});
