import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { locateOpa } from './opa';
import { snapshotEntry, type AuthzDecision, type AuthzSnapshotEntry } from '../../shared/authz-snapshot';

/**
 * Generates the two committed artifacts derived from the shared policy: the
 * frontend capability/reason types and the persona decision snapshot. `check`
 * regenerates in memory and fails when either file is stale, so a policy change
 * cannot land without its generated surface. Run with `bun`.
 */

const MODULE_DIR = (import.meta as unknown as { dir?: string }).dir ?? process.cwd();
const REPO_ROOT = join(MODULE_DIR, '..', '..');
const POLICY_DIR = join(REPO_ROOT, 'authz-service');
const PERSONAS_PATH = join(POLICY_DIR, 'fixtures', 'personas.json');
const TYPES_PATH = join(MODULE_DIR, '..', 'src', 'core', 'authz', 'generated.ts');
const SNAPSHOT_PATH = join(POLICY_DIR, 'fixtures', 'matrix.snapshot.json');

interface Persona {
  id: string;
  provider: string;
  claims: Record<string, unknown>;
}

interface PersonasFile {
  config: unknown;
  personas: Persona[];
}

function opaJson(query: string, input?: unknown): unknown {
  const opa = locateOpa();
  if (!opa) throw new Error('opa was not found; install OPA 1.4.2 or set OPA_BIN');
  const args = ['eval', '-d', POLICY_DIR, '--format=json', query];
  if (input !== undefined) args.push('--stdin-input');
  const result = spawnSync(opa, args, {
    encoding: 'utf8',
    input: input === undefined ? undefined : JSON.stringify(input),
  });
  if (result.status !== 0) {
    throw new Error(`opa eval failed: ${(result.stderr || result.stdout).trim()}`);
  }
  const parsed = JSON.parse(result.stdout) as {
    result?: Array<{ expressions: Array<{ value: unknown }> }>;
  };
  return parsed.result?.[0]?.expressions?.[0]?.value;
}

export function typesContent(): string {
  const capabilities = (opaJson('data.authz.capability_ids') as string[]).slice().sort();
  const reasons = opaJson('data.authz.reason_precedence') as string[];
  const lines = [
    '/**',
    ' * Generated from the shared policy by `frontend/scripts/authz-codegen.ts`.',
    ' * Do not edit by hand; run `bun run gen:authz`.',
    ' */',
    '',
    'export const CAPABILITY_IDS = [',
    ...capabilities.map(id => `  '${id}',`),
    '] as const;',
    '',
    'export type CapabilityId = (typeof CAPABILITY_IDS)[number];',
    '',
    'export const AUTHZ_REASONS = [',
    ...reasons.map(reason => `  '${reason}',`),
    '] as const;',
    '',
    'export type AuthzReason = (typeof AUTHZ_REASONS)[number];',
    '',
  ];
  return lines.join('\n');
}

export function snapshotContent(): string {
  const file = JSON.parse(readFileSync(PERSONAS_PATH, 'utf8')) as PersonasFile;
  const snapshot: Record<string, AuthzSnapshotEntry> = {};
  for (const persona of file.personas) {
    const query = `data.authz.capabilities with data.authz.config as ${JSON.stringify(file.config)}`;
    const decisions = opaJson(query, {
      provider: persona.provider,
      claims: persona.claims,
    }) as Record<string, AuthzDecision>;
    snapshot[persona.id] = snapshotEntry(decisions);
  }
  return `${JSON.stringify({ snapshot }, null, 2)}\n`;
}

function reportStale(stale: string[]): never {
  process.stderr.write(
    `Generated authz artifacts are stale: ${stale.join(', ')}. Run \`bun run gen:authz\`.\n`
  );
  process.exit(1);
}

function main(): void {
  const mode = process.argv[2] ?? 'generate';
  const types = typesContent();
  const snapshot = snapshotContent();
  if (mode === 'check') {
    const stale: string[] = [];
    if (readFileSync(TYPES_PATH, 'utf8') !== types) stale.push('generated.ts');
    if (readFileSync(SNAPSHOT_PATH, 'utf8') !== snapshot) stale.push('matrix.snapshot.json');
    if (stale.length > 0) reportStale(stale);
    return;
  }
  writeFileSync(TYPES_PATH, types);
  writeFileSync(SNAPSHOT_PATH, snapshot);
}

if (import.meta.main) main();
