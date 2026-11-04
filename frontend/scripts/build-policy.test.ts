import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '../../shared/providers';
import { assertWithinBudget, buildPolicyWasm, locateOpa } from './build-policy';

const REPO_ROOT = join(process.cwd(), '..');
const FIXTURES = join(process.cwd(), 'scripts', 'fixtures');
const OPA_ABSENT = locateOpa() === null;

describe('policy build', () => {
  for (const provider of PROVIDER_IDS) {
    it.skipIf(OPA_ABSENT)(
      `rejects an unsupported built-in planted in the ${provider} provider`,
      async () => {
        const dir = mkdtempSync(join(tmpdir(), 'authz-planted-'));
        try {
          cpSync(join(REPO_ROOT, 'policy', 'authz'), join(dir, 'authz'), { recursive: true });
          writeFileSync(
            join(dir, 'authz', 'providers', `${provider}.rego`),
            readFileSync(join(FIXTURES, `unsupported-built-in-${provider}.rego`))
          );
          await expect(buildPolicyWasm({ policyDir: join(dir, 'authz') })).rejects.toThrow(/http\.send/);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    );
  }

  it('rejects a wasm artifact over the size budget', () => {
    expect(() => assertWithinBudget(new Uint8Array(11), 10)).toThrow(/budget/);
  });

  it('keeps the built policy out of git and ignores its output directory', () => {
    // The provider-bundle checks run this suite against a copied tree with no
    // `.git`, so there is nothing to assert there.
    const inRepo =
      spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout.trim() ===
      'true';
    if (!inRepo) return;

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
