import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { AUTHZ_TABLE_NAMES } from '../../shared/authz-tables';
import { buildBundle, bundleTableKeys, evalBundle } from './build-bundle';

const OPA_BIN = process.env.OPA_BIN ?? 'opa';
const AUTHZ_DIR = join(import.meta.dir, '..', 'authz');

/** Runs the same signature verification the OPA container runs at startup. */
function verifyBundle(bundle: string, verificationKey: string): number {
  const result = spawnSync(
    OPA_BIN,
    [
      'build',
      '-b',
      '--verification-key',
      verificationKey,
      '--signing-alg',
      'ES256',
      '-o',
      '/dev/null',
      bundle,
    ],
    { encoding: 'utf8' }
  );
  if (result.error) throw result.error;
  if (result.status === null) {
    throw new Error(`opa did not exit: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.status;
}

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

  test('rejects a bundle whose contents changed after signing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'authz-bundle-test-'));
    try {
      const { signingKey, verificationKey } = generateKeyPair(dir);
      const out = join(dir, 'authz-bundle.tar.gz');
      buildBundle({ out, signingKey, verificationKey, revision: 'test' });

      // Re-gzip the exact tar so the member names survive; only the archived
      // bytes change, which is what the signature covers.
      const tar = Buffer.from(gunzipSync(readFileSync(out)));
      const marker = Buffer.from('package authz.v1.gateway.entra');
      const at = tar.indexOf(marker);
      if (at === -1) throw new Error('the built bundle does not carry the entra wrapper');
      tar[at + marker.length - 1] ^= 0x01;
      const tampered = join(dir, 'tampered.tar.gz');
      writeFileSync(tampered, gzipSync(tar));

      expect(verifyBundle(tampered, verificationKey)).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects an unsigned bundle', () => {
    const dir = mkdtempSync(join(tmpdir(), 'authz-bundle-test-'));
    try {
      const { verificationKey } = generateKeyPair(dir);
      const unsigned = join(dir, 'unsigned.tar.gz');
      const build = spawnSync(OPA_BIN, ['build', '-b', '-o', unsigned, AUTHZ_DIR], {
        encoding: 'utf8',
      });
      if (build.status !== 0) {
        throw new Error(`unsigned build failed: ${(build.stderr || build.stdout).trim()}`);
      }
      expect(verifyBundle(unsigned, verificationKey)).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
