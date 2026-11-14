import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPolicy } from '@open-policy-agent/opa-wasm';
import type { LoadedPolicy } from '@open-policy-agent/opa-wasm';
import { describe, expect, it } from 'vitest';
import {
  snapshotEntry,
  type AuthzDecision,
  type AuthzSnapshotEntry,
} from '../../../../../shared/authz-snapshot';
import { parseCapabilities } from '../wasm';
import type { AuthzClaims, Capabilities } from '../types';
import { CAPABILITY_IDS } from '../types';

/**
 * The browser loads the real synced WASM with its static tables and must agree
 * with the downloaded persona snapshot. It skips only when a synced artifact or
 * contract fixture is missing (the build's `prebuild` hook produces them).
 */

const REPO_ROOT = new URL('../../../../../', import.meta.url).pathname.replace(/^\/@fs/, '');
const POLICY_DIR = join(REPO_ROOT, 'frontend', 'public', 'policy');
const CONTRACT_FIXTURES = join(REPO_ROOT, 'frontend', 'policy', 'contract', 'fixtures');
const PERSONAS = join(CONTRACT_FIXTURES, 'personas.json');
const SNAPSHOT = join(CONTRACT_FIXTURES, 'matrix.snapshot.json');

interface Persona {
  id: string;
  provider: string;
  claims: AuthzClaims;
}

interface PersonasFile {
  config: Record<string, Record<string, unknown>>;
  personas: Persona[];
}

function readArtifact(): {
  wasm: Uint8Array;
  tables: Record<string, unknown>;
  entrypoint: string;
} | null {
  const manifestPath = join(POLICY_DIR, 'manifest.json');
  const wasmPath = join(POLICY_DIR, 'policy.wasm');
  const dataPath = join(POLICY_DIR, 'data.json');
  if (!existsSync(manifestPath) || !existsSync(wasmPath) || !existsSync(dataPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { entrypoint?: unknown };
  const data = JSON.parse(readFileSync(dataPath, 'utf8')) as { authz?: Record<string, unknown> };
  if (!data.authz) return null;
  return {
    wasm: readFileSync(wasmPath),
    tables: data.authz,
    entrypoint: typeof manifest.entrypoint === 'string' ? manifest.entrypoint : 'authz/capabilities',
  };
}

const artifact = readArtifact();
const fixturesPresent = existsSync(PERSONAS) && existsSync(SNAPSHOT);
const personasFile = fixturesPresent
  ? (JSON.parse(readFileSync(PERSONAS, 'utf8')) as PersonasFile)
  : ({ config: {}, personas: [] } as PersonasFile);
const snapshot = fixturesPresent
  ? (JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as { snapshot: Record<string, AuthzSnapshotEntry> })
      .snapshot
  : {};
const skip = artifact === null || !fixturesPresent;

async function loadWithData(
  tables: Record<string, unknown>,
  provider: string,
  config: unknown
): Promise<LoadedPolicy> {
  const policy = await loadPolicy(artifact?.wasm as Uint8Array);
  policy.setData({ authz: { ...tables, config: { [provider]: config } } });
  return policy;
}

function decisionsFor(policy: LoadedPolicy, persona: Persona): Record<string, AuthzDecision> {
  const resultSet = policy.evaluate(
    { provider: persona.provider, claims: persona.claims },
    artifact?.entrypoint
  ) as Array<{ result?: Record<string, AuthzDecision> }>;
  return resultSet[0]?.result ?? {};
}

function projected(decisions: Record<string, AuthzDecision>): Capabilities {
  return parseCapabilities(decisions);
}

function asSnapshot(decisions: Capabilities): AuthzSnapshotEntry {
  return snapshotEntry(decisions);
}

describe('browser policy parity', () => {
  it.skipIf(skip)('matches the downloaded persona snapshot', async () => {
    const mismatches: unknown[] = [];
    for (const persona of personasFile.personas) {
      const config = personasFile.config[persona.provider];
      const policy = await loadWithData(
        artifact?.tables as Record<string, unknown>,
        persona.provider,
        config
      );
      const actual = asSnapshot(projected(decisionsFor(policy, persona)));
      const expected = snapshot[persona.id];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatches.push({ persona: persona.id, expected, actual });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it.skipIf(skip)('projects the synced artifact onto the browser capability ids', async () => {
    const persona = personasFile.personas[0];
    const policy = await loadWithData(
      artifact?.tables as Record<string, unknown>,
      persona.provider,
      personasFile.config[persona.provider]
    );
    const decisions = projected(decisionsFor(policy, persona));
    expect(Object.keys(decisions).sort()).toEqual([...CAPABILITY_IDS].sort());
  });

  it.skipIf(skip)('fails closed when the provider role map is missing', async () => {
    const policy = await loadWithData(
      { ...(artifact?.tables as Record<string, unknown>), role_map: {} },
      'entra',
      { tenant: 'tenant-1' }
    );
    const decisions = projected(
      decisionsFor(policy, {
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
      })
    );
    expect(decisions['nav.api.profile'].allowed).toBe(false);
    expect(decisions['nav.overview'].allowed).toBe(true);
  });
});
