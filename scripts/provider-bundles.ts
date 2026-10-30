import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PROVIDER_IDS } from '../shared/providers';

/**
 * Verifies the two provider-bundle properties the isolation refactor promises:
 * copying core + shared + one provider typechecks, and deleting one provider
 * plus its registry entry leaves the surviving suite green.
 *
 * Usage: bun run scripts/provider-bundles.ts [reuse|deletion|all]
 */

const MODE = process.argv[2] ?? 'all';
const REPO_ROOT = join(import.meta.dir, '..');

function trackedFiles(): string[] {
  const result = Bun.spawnSync(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
  });
  if (result.exitCode !== 0) throw new Error('git ls-files failed');
  return result.stdout.toString().split('\n').filter(Boolean);
}

function copy(relativePaths: string[], destination: string, keep: (path: string) => boolean): void {
  for (const path of relativePaths) {
    if (!keep(path)) continue;
    const target = join(destination, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(REPO_ROOT, path), target);
  }
}

function linkModules(destination: string): void {
  symlinkSync(join(REPO_ROOT, 'frontend', 'node_modules'), join(destination, 'frontend', 'node_modules'), 'dir');
}

/** Removes the import and array entry for every provider except the kept one. */
function filterRegistry(path: string, removeIds: readonly string[]): void {
  const lines = readFileSync(path, 'utf8').split('\n');
  const filtered = lines.filter(line => !removeIds.some(id => line.includes(`${id}Module`)));
  writeFileSync(path, filtered.join('\n'));
}

function run(command: string[], cwd: string, label: string): void {
  const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) {
    process.stderr.write(result.stdout.toString());
    process.stderr.write(result.stderr.toString());
    throw new Error(`${label} failed in ${cwd}`);
  }
}

function typecheck(packageDir: string): void {
  run(['bunx', 'tsc', '--noEmit', '-p', 'tsconfig.json'], packageDir, 'typecheck');
}

const FRONTEND_FILES = (path: string): boolean =>
  path.startsWith('shared/') ||
  path.startsWith('frontend/src/core/') ||
  path === 'frontend/src/providers/index.ts' ||
  path === 'frontend/src/vite-env.d.ts' ||
  path === 'frontend/tsconfig.json' ||
  path === 'frontend/vitest.setup.ts' ||
  path === 'frontend/vite.config.ts';

/** One provider folder plus core, shared and the registry listing only that provider. */
function checkReuseBundle(provider: string, files: string[]): string {
  const bundle = mkdtempSync(join(tmpdir(), 'archon-reuse-'));
  const providerFile = (path: string) =>
    path.startsWith(`frontend/src/providers/${provider}/`) && !path.includes('/__tests__/');
  copy(files, bundle, path => FRONTEND_FILES(path) || providerFile(path));
  filterRegistry(
    join(bundle, 'frontend/src/providers/index.ts'),
    PROVIDER_IDS.filter(id => id !== provider)
  );
  linkModules(bundle);
  typecheck(join(bundle, 'frontend'));
  return bundle;
}

/** The whole tree with one provider folder and its registry entry removed. */
function checkDeletionBundle(provider: string, files: string[]): string {
  const bundle = mkdtempSync(join(tmpdir(), 'archon-delete-'));
  const removedProvider = new RegExp(`(^|/)providers/${provider}/`);
  copy(files, bundle, path => !removedProvider.test(path));
  filterRegistry(join(bundle, 'frontend/src/providers/index.ts'), [provider]);
  linkModules(bundle);
  typecheck(join(bundle, 'frontend'));
  // Acceptance: the surviving suite must pass, not just typecheck.
  run(['bunx', 'vitest', 'run'], join(bundle, 'frontend'), 'frontend test');
  return bundle;
}

const files = trackedFiles();
const bundles: string[] = [];
try {
  if (MODE === 'reuse' || MODE === 'all') {
    for (const provider of PROVIDER_IDS) {
      bundles.push(checkReuseBundle(provider, files));
      console.log(`Reuse bundle typechecks for ${provider}.`);
    }
  }
  if (MODE === 'deletion' || MODE === 'all') {
    for (const provider of PROVIDER_IDS) {
      bundles.push(checkDeletionBundle(provider, files));
      console.log(`Deletion bundle typechecks and passes tests without ${provider}.`);
    }
  }
} finally {
  for (const bundle of bundles) rmSync(bundle, { recursive: true, force: true });
}
