import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONTRACT_DIR, readContractVocabulary } from './sync-policy';

/**
 * Generates the committed capability/reason types from the published
 * `authz-contract` package. `check` regenerates in memory and fails when the
 * file is stale, so a policy change cannot land without its generated surface.
 * Run with `bun`.
 */

const MODULE_DIR = (import.meta as unknown as { dir?: string }).dir ?? process.cwd();
const TYPES_PATH = join(MODULE_DIR, '..', 'src', 'core', 'authz', 'generated.ts');

export function typesContent(contractDir = DEFAULT_CONTRACT_DIR): string {
  const { capabilityIds, reasonPrecedence } = readContractVocabulary(
    contractDir,
    'run `bun run sync:policy` before generating authz types'
  );
  const capabilities = capabilityIds.slice().sort();
  const reasons = reasonPrecedence.slice();
  const lines = [
    '/**',
    ' * Generated from the pinned `authz-policy` contract by',
    ' * `frontend/scripts/authz-codegen.ts`. Do not edit by hand; run',
    ' * `bun run gen:authz`.',
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

function reportStale(stale: string[]): never {
  process.stderr.write(
    `Generated authz artifacts are stale: ${stale.join(', ')}. Run \`bun run gen:authz\`.\n`
  );
  process.exit(1);
}

function main(): void {
  const mode = process.argv[2] ?? 'generate';
  const types = typesContent();
  if (mode === 'check') {
    if (readFileSync(TYPES_PATH, 'utf8') !== types) reportStale(['generated.ts']);
    return;
  }
  writeFileSync(TYPES_PATH, types);
}

if (import.meta.main) main();
