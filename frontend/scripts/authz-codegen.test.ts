import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { typesContent } from './authz-codegen';

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'authz-codegen-'));
}

function writeContract(
  dir: string,
  body: { capability_ids: unknown; reason_precedence: unknown } = {
    capability_ids: ['nav.overview', 'data.order.list', 'nav.account'],
    reason_precedence: ['not_signed_in', 'missing_scope'],
  }
): void {
  mkdirSync(join(dir, 'fixtures'), { recursive: true });
  writeFileSync(join(dir, 'fixtures', 'capability-ids.json'), JSON.stringify(body));
}

describe('typesContent', () => {
  it('reads the contract and sorts the capability ids', () => {
    const dir = scratch();
    try {
      writeContract(dir);
      const content = typesContent(dir);
      expect(content).toContain("  'data.order.list',");
      expect(content).toContain("  'nav.account',");
      expect(content).toContain("  'nav.overview',");
      expect(content.indexOf("'data.order.list'")).toBeLessThan(content.indexOf("'nav.account'"));
      expect(content).toContain("  'not_signed_in',");
      expect(content).toContain("  'missing_scope',");
      expect(content).toContain('export type AuthzReason = (typeof AUTHZ_REASONS)[number];');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('emits no AuthzClaims', () => {
    const dir = scratch();
    try {
      writeContract(dir);
      expect(typesContent(dir)).not.toContain('AuthzClaims');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('names sync:policy when the contract is missing', () => {
    const dir = scratch();
    try {
      expect(() => typesContent(dir)).toThrow(/capability-ids\.json is missing[\s\S]*sync:policy/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects fields the sync check would reject', () => {
    const dir = scratch();
    try {
      for (const body of [
        { capability_ids: 'nav.overview', reason_precedence: [] },
        { capability_ids: ['nav.overview'], reason_precedence: [123, ''] },
      ]) {
        writeContract(dir, body);
        expect(() => typesContent(dir)).toThrow(/must be an array of non-empty strings/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
