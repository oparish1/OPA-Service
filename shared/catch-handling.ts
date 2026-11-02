import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { collectSourceFiles, toPosix } from './source-files';

/**
 * The no-silent-catch rule: every non-test catch block or `.catch()` in the
 * frontend must log through the shared logger, rethrow, or carry an explicit
 * `// log-exempt: <reason>` comment.
 */

export interface CatchSite {
  file: string;
  line: number;
  text: string;
}

export interface CatchHandlingReport {
  sites: CatchSite[];
  violations: CatchSite[];
}

const CATCH_BLOCK = /\bcatch\b\s*(?:\([^)]*\))?\s*\{/g;
const CATCH_CALL = /\.catch\s*\(/g;
const EXEMPT = /\/\/\s*log-exempt:\s*\S+/;
const LOGGER = /\blog\s*[.[]/;
const RETHROW = /\bthrow\b/;

function skipString(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
      continue;
    }
    if (source[index] === quote) return index;
  }
  return source.length - 1;
}

function findMatching(source: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' || character === "'" || character === '`') {
      index = skipString(source, index);
      continue;
    }
    if (character === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index);
      if (newline === -1) return -1;
      index = newline;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end === -1) return -1;
      index = end + 1;
      continue;
    }
    if (character === open) depth += 1;
    else if (character === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function handled(block: string): boolean {
  return LOGGER.test(block) || RETHROW.test(block) || EXEMPT.test(block);
}

/** Finds every catch site in one source string and reports the unhandled ones. */
export function findCatchSites(source: string, file = '<source>'): CatchHandlingReport {
  const sites: CatchSite[] = [];
  const violations: CatchSite[] = [];

  for (const match of source.matchAll(CATCH_BLOCK)) {
    const start = match.index ?? 0;
    const open = source.indexOf('{', start);
    const end = findMatching(source, open, '{', '}');
    if (end === -1) continue;
    const site = { file, line: lineAt(source, start), text: source.slice(start, end + 1) };
    sites.push(site);
    if (!handled(site.text)) violations.push(site);
  }

  for (const match of source.matchAll(CATCH_CALL)) {
    const start = match.index ?? 0;
    const open = source.indexOf('(', start);
    const end = findMatching(source, open, '(', ')');
    if (end === -1) continue;
    const site = { file, line: lineAt(source, start), text: source.slice(start, end + 1) };
    sites.push(site);
    if (!handled(site.text)) violations.push(site);
  }

  return { sites, violations };
}

function isTestFile(path: string): boolean {
  return path.includes(`${sep}__tests__${sep}`) || /\.test\.(ts|tsx)$/.test(path);
}

/** Scans `frontend/src` and returns every catch site plus the unhandled ones. */
export function findCatchHandlingViolations(repoRoot: string): CatchHandlingReport {
  const files = collectSourceFiles(join(repoRoot, 'frontend', 'src'), { keep: file => !isTestFile(file) });

  const report: CatchHandlingReport = { sites: [], violations: [] };
  for (const file of files) {
    const repoRelative = toPosix(relative(repoRoot, file));
    const found = findCatchSites(readFileSync(file, 'utf8'), repoRelative);
    report.sites.push(...found.sites);
    report.violations.push(...found.violations);
  }
  return report;
}
