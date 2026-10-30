import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { PROVIDER_IDS } from './providers';

/**
 * The mechanical isolation rule: outside the wire contract, the two registries
 * and the per-provider folders, no file may name more than one provider id.
 * Both package test suites call this so either package catches a regression.
 */

const SCAN_DIRS = ['frontend', 'shared', 'gateway'];
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const EXEMPT_FILES = new Set<string>([
  'shared/providers.ts',
  'frontend/src/providers/index.ts',
  // The gateway is a central multi-provider composition point, like a registry.
  'gateway/config.test.ts',
  'gateway/test-issuers/index.ts',
  'gateway/test-issuers/acceptance.ts',
]);

/** Identifier-boundary matching, so a name like `entrance` is not counted as `entra`. */
const ID_PATTERNS = PROVIDER_IDS.map(id => [id, new RegExp(`\\b${id}\\b`)] as const);
const PROVIDER_FOLDER = new RegExp(`(^|/)providers/(${PROVIDER_IDS.join('|')})/`);

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

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

function walk(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (SOURCE_EXTENSIONS.some(extension => entry.endsWith(extension))) files.push(full);
  }
}

/** Returns one line per file that names more than one provider id. */
export function findProviderIsolationViolations(repoRoot: string): string[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) walk(join(repoRoot, dir), files);

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
