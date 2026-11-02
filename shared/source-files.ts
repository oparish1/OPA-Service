import { readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

/** The single owner of "which files are source" for the repository checks. */

export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
export const DEFAULT_EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);

export function toPosix(path: string): string {
  return path.split(sep).join('/');
}

export interface CollectSourceFilesOptions {
  extensions?: readonly string[];
  excludeDirs?: ReadonlySet<string>;
  keep?: (file: string) => boolean;
}

export function collectSourceFiles(
  root: string,
  { extensions = SOURCE_EXTENSIONS, excludeDirs = DEFAULT_EXCLUDE_DIRS, keep }: CollectSourceFilesOptions = {}
): string[] {
  const files: string[] = [];
  walk(root, files, extensions, excludeDirs, keep ?? (() => true));
  return files;
}

function walk(
  dir: string,
  files: string[],
  extensions: readonly string[],
  excludeDirs: ReadonlySet<string>,
  keep: (file: string) => boolean
): void {
  for (const entry of readdirSync(dir)) {
    if (excludeDirs.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files, extensions, excludeDirs, keep);
    else if (extensions.some(extension => entry.endsWith(extension)) && keep(full)) files.push(full);
  }
}
