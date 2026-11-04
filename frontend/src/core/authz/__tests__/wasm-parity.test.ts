import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPolicy } from '@open-policy-agent/opa-wasm';
import { describe, expect, it } from 'vitest';

/**
 * A7: the browser loads the real compiled WASM and must agree with the Rego
 * test on every golden case. It skips only when no build artifact exists.
 */

const REPO_ROOT = new URL('../../../../../', import.meta.url).pathname.replace(/^\/@fs/, '');
const POLICY_DIR = join(REPO_ROOT, 'frontend', 'public', 'policy');
const FIXTURE = join(REPO_ROOT, 'policy', 'fixtures', 'decisions.json');

interface GoldenCase {
  id: string;
  provider: string;
  capability: string;
  claims: Record<string, unknown>;
  request?: Record<string, unknown>;
  allowed: boolean;
  reason: string;
}

function readWasm(): Uint8Array | null {
  const manifestPath = join(POLICY_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { wasm: string };
  const wasmPath = join(POLICY_DIR, manifest.wasm);
  if (!existsSync(wasmPath)) return null;
  return readFileSync(wasmPath);
}

const wasm = readWasm();

describe('browser policy parity (A7)', () => {
  it.skipIf(wasm === null)('matches the golden decision table', async () => {
    const policy = await loadPolicy(wasm as Uint8Array);
    const table = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
      config: Record<string, unknown>;
      cases: GoldenCase[];
    };
    policy.setData({ authz: { config: table.config } });

    const mismatches: unknown[] = [];
    for (const testCase of table.cases) {
      const resultSet = policy.evaluate({
        provider: testCase.provider,
        claims: testCase.claims,
        request: testCase.request ?? {},
      }) as Array<{ result?: Record<string, { allowed: boolean; reason: string }> }>;
      const decision = resultSet[0]?.result?.[testCase.capability];
      if (
        !decision ||
        decision.allowed !== testCase.allowed ||
        decision.reason !== testCase.reason
      ) {
        mismatches.push({
          id: testCase.id,
          expected: { allowed: testCase.allowed, reason: testCase.reason },
          actual: decision,
        });
      }
    }

    expect(mismatches).toEqual([]);
  });
});
