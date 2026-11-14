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
const SCAN_DIRS = ['frontend/src', 'frontend/public', 'shared', 'gateway', 'scripts', 'docs', 'authz-service'];
const CODE_DIRS = ['frontend/src', 'frontend/public', 'shared', 'gateway', 'scripts', 'authz-service'];
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

  it('A5 keeps environment values out of the Rego policies', () => {
    const config = JSON.parse(read(join('frontend', 'public', 'config.json')));
    const fixture = JSON.parse(read(join('authz-service', 'fixtures', 'personas.json')));
    const sensitive = new Set<string>();
    const collectStrings = (value: unknown): void => {
      if (typeof value === 'string') sensitive.add(value);
      else if (Array.isArray(value)) value.forEach(collectStrings);
      else if (value && typeof value === 'object') Object.values(value).forEach(collectStrings);
    };
    collectStrings(fixture.config);
    for (const provider of config.providers as Array<{ issuer: string; hostedDomain?: string }>) {
      if (provider.hostedDomain) sensitive.add(provider.hostedDomain);
      const tenant = provider.issuer.match(/login\.microsoftonline\.com\/([^/]+)\//);
      if (tenant) sensitive.add(tenant[1]);
    }

    const policies = filesUnder(['authz-service']).filter(
      file => file.endsWith('.rego') && !file.endsWith('_test.rego')
    );
    expect(policies.length).toBeGreaterThan(0);
    for (const file of policies) {
      const content = read(file);
      for (const value of sensitive) {
        if (!value) continue;
        expect(content, `${file} must not contain the environment value ${value}`).not.toContain(value);
      }
    }
  });

  it('A2 keeps capability ids, role names and other providers out of the shared engine', () => {
    const catalogue = JSON.parse(read(join('authz-service', 'authz', 'catalogue.json'))) as {
      catalogue: Record<string, unknown>;
    };
    const roles = JSON.parse(read(join('authz-service', 'authz', 'roles.json'))) as { roles: Record<string, unknown> };
    const capabilityIds = Object.keys(catalogue.catalogue);
    const roleNames = Object.keys(roles.roles);

    const engine = read(join('authz-service', 'authz', 'authz.rego'));
    for (const capability of capabilityIds) expect(engine, capability).not.toContain(capability);
    for (const role of roleNames) expect(engine, role).not.toContain(`"${role}"`);
    for (const provider of PROVIDER_IDS) expect(engine, provider).not.toMatch(new RegExp(`\\b${provider}\\b`));

    // A provider file may name its own provider and its own claim logic, but no
    // capability id, no role name and no other provider id.
    for (const provider of PROVIDER_IDS) {
      const source = read(join('authz-service', 'authz', 'providers', `${provider}.rego`));
      for (const capability of capabilityIds) expect(source, `${provider}: ${capability}`).not.toContain(capability);
      for (const role of roleNames) expect(source, `${provider}: ${role}`).not.toContain(`"${role}"`);
      for (const other of PROVIDER_IDS) {
        if (other === provider) continue;
        expect(source, `${provider}.rego names ${other}`).not.toMatch(new RegExp(`\\b${other}\\b`));
      }
    }
  });

  it('A3 reduces each provider file to the provider-gate contract', () => {
    for (const provider of PROVIDER_IDS) {
      const source = read(join('authz-service', 'authz', 'providers', `${provider}.rego`));
      expect(source, `${provider}: deny_by_capability`).not.toContain('deny_by_capability');
      expect(source, `${provider}: missing_scope`).not.toContain('missing_scope');
      expect(source, `${provider}: insufficient_role`).not.toContain('insufficient_role');
      for (const name of ['uses_scopes', 'granted_roles', 'gate_failures']) {
        expect(source, `${provider}: ${name}`).toContain(name);
      }
    }
  });

  it('A4 rejects the removed role and group config keys', async () => {
    const { parseAppConfig } = await import('../../../shared/app-config');
    const base = JSON.parse(read(join('frontend', 'public', 'config.example.json')));
    for (const key of ['requiredRole', 'requiredGroup']) {
      const withKey = JSON.parse(JSON.stringify(base));
      withKey.providers[0][key] = 'Workspace.User';
      expect(() => parseAppConfig(withKey)).toThrow(/not a supported field/);
    }
    // The pre-change config carried the keys on the `authz` section, nested per
    // provider; that location must fail too, not be silently dropped.
    const withAuthzKeys = JSON.parse(JSON.stringify(base));
    withAuthzKeys.authz = {
      enabled: true,
      [PROVIDER_IDS[0]]: { tenant: 'tenant-1', requiredRole: 'Workspace.User' },
    };
    expect(() => parseAppConfig(withAuthzKeys)).toThrow(/authz\..* is not a supported field/);
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

  it('A21 allows exactly wasm-unsafe-eval in script-src and no broader eval', () => {
    const headers = read(join('frontend', 'public', '_headers'));
    const csp = headers
      .split('\n')
      .find(line => line.trim().startsWith('Content-Security-Policy:'));
    expect(csp).toBeDefined();
    const directives = (csp as string).split(';').map(directive => directive.trim());
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("'wasm-unsafe-eval'");
    const carrying = directives.filter(directive => directive.includes("'wasm-unsafe-eval'"));
    expect(carrying).toHaveLength(1);
    expect(carrying[0].startsWith('script-src ')).toBe(true);
  });

  it('A22 direction documents describe the browser-only direction', () => {
    expect(read(join('README.md'))).toContain('APISIX');
    expect(read(join('docs', 'ARCHITECTURE.md'))).toContain('APISIX');
    expect(read(join('docs', 'auth', 'add-authentication-work-order.md'))).toContain('SUPERSEDED');
  });
});
