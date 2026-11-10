import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { generateBundleKey } from './generate-bundle-key';

describe('gateway bundle signing key', () => {
  test('writes a P-256 private key and its matching public key', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gateway-bundle-key-'));
    try {
      const privatePath = join(dir, 'nested', 'ephemeral.pem');
      const publicPath = join(dir, 'nested', 'ephemeral.pub');
      generateBundleKey(privatePath, publicPath);
      expect(readFileSync(privatePath, 'utf8')).toContain('BEGIN PRIVATE KEY');
      expect(readFileSync(publicPath, 'utf8')).toContain('BEGIN PUBLIC KEY');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
