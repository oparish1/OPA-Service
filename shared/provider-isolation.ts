import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PROVIDER_IDS } from './providers';
import { collectSourceFiles, toPosix } from './source-files';

/**
 * The mechanical isolation rule: outside the wire contract, the two registries
 * and the per-provider folders, no file may name more than one provider id.
 * The frontend test suite calls this so the check runs in CI.
 */

const SCAN_DIRS = ['frontend', 'shared'];

const EXEMPT_FILES = new Set<string>([
  'shared/providers.ts',
  'frontend/src/providers/index.ts',
]);

/** Identifier-boundary matching, so a name like `entrance` is not counted as `entra`. */
const ID_PATTERNS = PROVIDER_IDS.map(id => [id, new RegExp(`\\b${id}\\b`)] as const);
const PROVIDER_FOLDER = new RegExp(`(^|/)providers/(${PROVIDER_IDS.join('|')})/`);

function isExempt(repoRelative: string): boolean {
  return EXEMPT_FILES.has(repoRelative) || PROVIDER_FOLDER.test(repoRelative);
}

function collectProviderIds(source: string): Set<string> {
  const found = new Set<string>();
  for (const [id, pattern] of ID_PATTERNS) {
    if (pattern.test(source)) found.add(id);
  }
  return found;
}

/** Returns one line per file that names more than one provider id. */
export function findProviderIsolationViolations(repoRoot: string): string[] {
  const files = SCAN_DIRS.flatMap(dir => collectSourceFiles(join(repoRoot, dir)));

  const violations: string[] = [];
  for (const file of files) {
    const repoRelative = toPosix(relative(repoRoot, file));
    if (isExempt(repoRelative)) continue;
    const ids = collectProviderIds(readFileSync(file, 'utf8'));
    if (ids.size > 1) violations.push(`${repoRelative}: ${[...ids].sort().join(', ')}`);
  }
  return violations;
}

export function assertProviderIsolation(repoRoot: string): void {
  const violations = findProviderIsolationViolations(repoRoot);
  if (violations.length > 0) {
    throw new Error(
      `Provider isolation check failed; a file names more than one provider:\n  ${violations.join('\n  ')}`
    );
  }
}
