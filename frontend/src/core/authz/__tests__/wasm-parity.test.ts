import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPolicy } from '@open-policy-agent/opa-wasm';
import type { LoadedPolicy } from '@open-policy-agent/opa-wasm';
import { describe, expect, it } from 'vitest';
import { AUTHZ_REASON_COPY } from '../../lib/copy';
import { getSnapshot, setError } from '../store';
import { AUTHZ_REASONS, CAPABILITY_IDS } from '../types';

/**
 * TS-10/TS-11: the browser loads the real compiled WASM with the same static
 * tables and must agree with the committed persona snapshot. It skips only when
 * no build artifact exists.
 */

const REPO_ROOT = new URL('../../../../../', import.meta.url).pathname.replace(/^\/@fs/, '');
const POLICY_DIR = join(REPO_ROOT, 'frontend', 'public', 'policy');
const PERSONAS = join(REPO_ROOT, 'policy', 'fixtures', 'personas.json');
const SNAPSHOT = join(REPO_ROOT, 'policy', 'fixtures', 'matrix.snapshot.json');

interface Decision {
  allowed: boolean;
  reason: string;
}

interface Persona {
  id: string;
  provider: string;
  claims: Record<string, unknown>;
}

interface SnapshotEntry {
  allowed: string[];
  denied: Record<string, string>;
}

function readArtifact(): { wasm: Uint8Array; tables: Record<string, unknown> } | null {
  const manifestPath = join(POLICY_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { wasm: string; data: string };
  const wasmPath = join(POLICY_DIR, manifest.wasm);
  const dataPath = join(POLICY_DIR, manifest.data);
  if (!existsSync(wasmPath) || !existsSync(dataPath)) return null;
  const data = JSON.parse(readFileSync(dataPath, 'utf8')) as { authz: Record<string, unknown> };
  return { wasm: readFileSync(wasmPath), tables: data.authz };
}

const artifact = readArtifact();
const personasFile = JSON.parse(readFileSync(PERSONAS, 'utf8')) as {
  config: Record<string, Record<string, unknown>>;
  personas: Persona[];
};
const snapshot = (JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as { snapshot: Record<string, SnapshotEntry> })
  .snapshot;

async function loadWithData(tables: Record<string, unknown>, provider: string, config: unknown): Promise<LoadedPolicy> {
  const policy = await loadPolicy(artifact?.wasm as Uint8Array);
  policy.setData({ authz: { ...tables, config: { [provider]: config } } });
  return policy;
}

function decisionsFor(policy: LoadedPolicy, persona: Persona): Record<string, Decision> {
  const resultSet = policy.evaluate({ provider: persona.provider, claims: persona.claims }) as Array<{
    result?: Record<string, Decision>;
  }>;
  return resultSet[0]?.result ?? {};
}

function normalized(decisions: Record<string, Decision>): SnapshotEntry {
  const allowed: string[] = [];
  const denied: Record<string, string> = {};
  for (const capability of Object.keys(decisions).sort()) {
    if (decisions[capability].allowed) allowed.push(capability);
    else denied[capability] = decisions[capability].reason;
  }
  return { allowed, denied };
}

describe('browser policy parity (TS-10)', () => {
  it.skipIf(artifact === null)('matches the committed persona snapshot', async () => {
    const mismatches: unknown[] = [];
    for (const persona of personasFile.personas) {
      const config = personasFile.config[persona.provider];
      const policy = await loadWithData(artifact?.tables as Record<string, unknown>, persona.provider, config);
      const actual = normalized(decisionsFor(policy, persona));
      const expected = snapshot[persona.id];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatches.push({ persona: persona.id, expected, actual });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it.skipIf(artifact === null)('binds the artifact to the browser catalogue and baseline floor', async () => {
    const policy = await loadWithData(artifact?.tables as Record<string, unknown>, 'entra', {
      tenant: 'tenant-1',
    });
    const decisions = decisionsFor(policy, {
      id: 'floor',
      provider: 'entra',
      claims: { has_subject: true, roles: [], groups: [], scopes: [], tenant: 'tenant-1', hd: '', email_verified: false },
    });

    expect(Object.keys(decisions).sort()).toEqual([...CAPABILITY_IDS].sort());

    const allowed = (map: Record<string, Decision>): string[] =>
      Object.entries(map)
        .filter(([, decision]) => decision.allowed)
        .map(([id]) => id)
        .sort();

    setError();
    expect(allowed(getSnapshot().capabilities)).toEqual(allowed(decisions));
  });

  it.skipIf(artifact === null)('fails closed when the provider role map is missing (A20)', async () => {
    const policy = await loadWithData(
      { ...(artifact?.tables as Record<string, unknown>), role_map: {} },
      'entra',
      { tenant: 'tenant-1' }
    );
    const decisions = decisionsFor(policy, {
      id: 'no-role-map',
      provider: 'entra',
      claims: {
        has_subject: true,
        roles: ['Workspace.User'],
        groups: [],
        scopes: ['workspace:read', 'workspace:write'],
        tenant: 'tenant-1',
        hd: '',
        email_verified: false,
      },
    });
    expect(decisions['nav.api.profile'].allowed).toBe(false);
    expect(decisions['nav.overview'].allowed).toBe(true);
  });

  it('gives every policy reason approved copy (FE-2)', () => {
    for (const reason of AUTHZ_REASONS) {
      expect(AUTHZ_REASON_COPY, reason).toHaveProperty(reason);
    }
  });
});

describe('browser policy budget (TS-11)', () => {
  it.skipIf(artifact === null)('evaluates a 150-capability catalogue within the budget', async () => {
    const catalogue: Record<string, { kind: string; role: string | null; scope: string | null }> = {
      'bench.baseline': { kind: 'baseline', role: null, scope: null },
    };
    for (let index = 0; index < 150; index += 1) {
      catalogue[`bench.read.${String(index).padStart(3, '0')}`] = {
        kind: 'read',
        role: 'user',
        scope: 'workspace:read',
      };
    }
    const policy = await loadWithData(
      { ...(artifact?.tables as Record<string, unknown>), catalogue },
      'entra',
      { tenant: 'tenant-1' }
    );
    const start = performance.now();
    const decisions = decisionsFor(policy, {
      id: 'bench',
      provider: 'entra',
      claims: {
        has_subject: true,
        roles: ['Workspace.Admin'],
        groups: [],
        scopes: ['workspace:read'],
        tenant: 'tenant-1',
        hd: '',
        email_verified: false,
      },
    });
    const elapsed = performance.now() - start;
    expect(Object.keys(decisions)).toHaveLength(151);
    console.log(`authz evaluation of 150 capabilities: ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(250);
  });
});
