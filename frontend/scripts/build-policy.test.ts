import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertWithinBudget, buildPolicyWasm, locateOpa } from './build-policy';

const REPO_ROOT = join(process.cwd(), '..');
const FIXTURES = join(process.cwd(), 'scripts', 'fixtures');
const OPA_ABSENT = locateOpa() === null;

describe('policy build', () => {
  it.skipIf(OPA_ABSENT)(
    'rejects a policy that uses a built-in the WASM target cannot execute',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'authz-planted-'));
      try {
        cpSync(join(REPO_ROOT, 'policy', 'authz'), join(dir, 'authz'), { recursive: true });
        writeFileSync(
          join(dir, 'authz', 'providers', 'entra.rego'),
          readFileSync(join(FIXTURES, 'unsupported-built-in.rego'))
        );
        await expect(buildPolicyWasm({ policyDir: join(dir, 'authz') })).rejects.toThrow(/http\.send/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );

  it('rejects a wasm artifact over the size budget', () => {
    expect(() => assertWithinBudget(new Uint8Array(11), 10)).toThrow(/budget/);
  });

  it('keeps the built policy out of git and ignores its output directory', () => {
    const tracked = spawnSync('git', ['ls-files', 'frontend/public/policy'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(tracked.stdout.trim()).toBe('');
    const ignored = spawnSync('git', ['check-ignore', 'frontend/public/policy/manifest.json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(ignored.status).toBe(0);
  });
});
