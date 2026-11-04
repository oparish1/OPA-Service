import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '../../../shared/providers';

/**
 * Repository-level acceptance (A18–A22). These read the whole tree, not just
 * `frontend/`, so they run from the frontend suite but assert the shipped repo.
 */

// Vite may expose `import.meta.url` under its `/@fs` virtual prefix in tests.
const REPO_ROOT = new URL('../../../', import.meta.url).pathname.replace(/^\/@fs/, '');
const SCAN_DIRS = ['frontend/src', 'frontend/public', 'shared', 'gateway', 'scripts', 'docs'];
const CODE_DIRS = ['frontend/src', 'frontend/public', 'shared', 'gateway', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);
const TEXT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yaml', '.yml', '.sh', '.rego'];

function walk(relativeDir: string, files: string[]): void {
  const absolute = join(REPO_ROOT, relativeDir);
  if (!existsSync(absolute)) return;
  for (const entry of readdirSync(absolute)) {
    if (SKIP_DIRS.has(entry)) continue;
    const relative = `${relativeDir}${sep}${entry}`;
    if (statSync(join(REPO_ROOT, relative)).isDirectory()) walk(relative, files);
    else files.push(relative);
  }
}

function filesUnder(dirs: string[]): string[] {
  const files: string[] = [];
  for (const dir of dirs) walk(dir, files);
  return files.filter(file => TEXT_EXTENSIONS.some(extension => file.endsWith(extension)));
}

function scannedFiles(): string[] {
  return filesUnder(SCAN_DIRS);
}

function read(file: string): string {
  return readFileSync(join(REPO_ROOT, file), 'utf8');
}

describe('repository acceptance', () => {
  it('A18 finds no private key or client secret in the repo', () => {
    expect(existsSync(join(REPO_ROOT, 'app.key'))).toBe(false);
    expect(existsSync(join(REPO_ROOT, 'app.crt'))).toBe(false);

    for (const file of scannedFiles()) {
      if (file.includes('.test.')) continue;
      const content = read(file);
      expect(content, file).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
      expect(content, file).not.toMatch(/client_secret\s*[:=]\s*["']?(?!\$\{\{)[^"'\s]/);
      expect(content, file).not.toMatch(/AKIA[0-9A-Z]{16}/);
    }
  });

  it('A18 validates the committed example config and rejects a secret-shaped value', async () => {
    const { parseAppConfig } = await import('../../../shared/app-config');
    const example = JSON.parse(read(join('frontend', 'public', 'config.example.json')));
    expect(() => parseAppConfig(example)).not.toThrow();
    // The demo config is committed (a deployment overrides it); when present it
    // must still satisfy the schema and carry no secret-shaped value.
    const committed = join(REPO_ROOT, 'frontend', 'public', 'config.json');
    if (existsSync(committed)) {
      expect(() => parseAppConfig(JSON.parse(readFileSync(committed, 'utf8')))).not.toThrow();
    }
  });

  it('A18 scans the production bundle when one has been built', () => {
    const dist = join(REPO_ROOT, 'frontend', 'dist');
    if (!existsSync(dist)) return;
    const files: string[] = [];
    const collect = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collect(full);
        else files.push(full);
      }
    };
    collect(dist);
    const placeholderSecrets = PROVIDER_IDS.map(id => `test-${id}-secret`);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content, file).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
      for (const secret of placeholderSecrets) expect(content, file).not.toContain(secret);
    }
  });

  it('A19 names no retired scope anywhere', () => {
    for (const file of scannedFiles()) {
      const content = read(file);
      expect(content, file).not.toMatch(/\bprofile\.read\b/);
      expect(content, file).not.toMatch(/\bprojects\.read\b/);
    }
  });

  it('A20 leaves no backend, build-time auth flag, auth.env or database code', () => {
    expect(existsSync(join(REPO_ROOT, 'backend', 'package.json'))).toBe(false);
    expect(existsSync(join(REPO_ROOT, 'backend', 'src'))).toBe(false);
    for (const file of filesUnder(CODE_DIRS)) {
      if (file.includes('.test.')) continue;
      const content = read(file);
      expect(content, file).not.toMatch(/VITE_AUTH_MODE/);
      expect(content, file).not.toMatch(/auth\.env/);
      expect(content, file).not.toMatch(/\bDATABASE_URL\b/);
      expect(content, file).not.toMatch(/\bsqlite\b/i);
      expect(content, file).not.toMatch(/CREATE TABLE/i);
    }
  });

  it('A22 direction documents describe the browser-only direction', () => {
    expect(read(join('README.md'))).toContain('APISIX');
    expect(read(join('docs', 'ARCHITECTURE.md'))).toContain('APISIX');
    expect(read(join('docs', 'auth', 'add-authentication-work-order.md'))).toContain('SUPERSEDED');
  });
});
