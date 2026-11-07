import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { locateOpa } from './build-policy';

/**
 * A10: the gateway and the browser read one source. Removing a claim rule from
 * the shared policy must fail both the gateway wrapper tests and the golden
 * table in the same `opa test` run.
 */

const REPO_ROOT = join(process.cwd(), '..');
const OPA = locateOpa();

describe('single policy source (A10)', () => {
  it.skipIf(OPA === null)('fails both suites when a shared rule is removed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'authz-parity-'));
    try {
      cpSync(join(REPO_ROOT, 'policy'), join(dir, 'policy'), { recursive: true });
      cpSync(join(REPO_ROOT, 'gateway', 'opa'), join(dir, 'gateway', 'opa'), { recursive: true });

      const entra = join(dir, 'policy', 'authz', 'providers', 'entra.rego');
      const original = readFileSync(entra, 'utf8');
      const mutated = original.replace('uses_scopes := true', 'uses_scopes := false');
      expect(mutated).not.toBe(original);
      writeFileSync(entra, mutated);

      const result = spawnSync(OPA as string, ['test', join(dir, 'policy'), join(dir, 'gateway', 'opa')], {
        encoding: 'utf8',
      });
      const output = `${result.stdout}\n${result.stderr}`;
      expect(result.status).not.toBe(0);
      expect(output).toContain('data.authz.test_gate_cases: FAIL');
      expect(output).toContain('data.entra.test_missing_scope_is_denied: FAIL');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
