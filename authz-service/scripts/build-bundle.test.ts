import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { AUTHZ_TABLE_NAMES } from '../../shared/authz-tables';
import { buildBundle, bundleTableKeys, evalBundle } from './build-bundle';

function generateKeyPair(dir: string): { signingKey: string; verificationKey: string } {
  const signingKey = join(dir, 'private.pem');
  const verificationKey = join(dir, 'public.pem');
  for (const args of [
    ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', signingKey],
    ['ec', '-in', signingKey, '-pubout', '-out', verificationKey],
  ]) {
    const result = spawnSync('openssl', args, { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`openssl failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return { signingKey, verificationKey };
}

describe('signed bundle data document', () => {
  test('carries every shared table and no baked environment config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'authz-bundle-test-'));
    try {
      const { signingKey, verificationKey } = generateKeyPair(dir);
      const out = join(dir, 'authz-bundle.tar.gz');
      buildBundle({ out, signingKey, verificationKey, revision: 'test' });
      for (const name of AUTHZ_TABLE_NAMES) expect(bundleTableKeys(out, name), name).not.toHaveLength(0);
      expect(evalBundle(out, 'data.authz.config')).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
