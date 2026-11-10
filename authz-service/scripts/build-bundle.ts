import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { AUTHZ_TABLE_NAMES } from '../../shared/authz-tables';

/**
 * Builds and signs the authz bundle. `opa build -b` only reads a file named
 * `data.json`, so the source tables and the dev config are merged into the
 * staged `authz/data.json`; without that merge the bundle loses the catalogue,
 * roles, role map and routes and denies everything. The signed bundle is then
 * verified against the committed public key and checked for a non-empty
 * catalogue before the command succeeds.
 */

const SERVICE_DIR = join(import.meta.dir, '..');
const AUTHZ_DIR = join(SERVICE_DIR, 'authz');
const DEFAULT_OUT = join(SERVICE_DIR, 'dist', 'authz-bundle.tar.gz');
const DEFAULT_REVISION = readFileSync(join(SERVICE_DIR, 'VERSION'), 'utf8').trim();
// `data` is the dev config document, not a shipped table, so it is named here
// beside the shared table owner rather than being another hand-written list.
const DATA_FILES = ['data', ...AUTHZ_TABLE_NAMES] as const;

interface Options {
  out: string;
  signingKey: string;
  verificationKey: string;
  revision: string;
}

function usage(): never {
  console.error(
    'usage: bun run authz-service/scripts/build-bundle.ts --signing-key <pem> --verification-key <pem> [--out <tar.gz>] [--revision <version>]'
  );
  process.exit(1);
}

function parseOptions(argv: string[]): Options {
  const values: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) usage();
    const [name, inline] = arg.slice(2).split('=', 2);
    const value = inline ?? argv[index + 1];
    if (value === undefined || value.startsWith('--')) usage();
    values[name] = value;
    if (inline === undefined) index += 1;
  }
  if (!values['signing-key'] || !values['verification-key']) usage();
  return {
    out: resolve(values.out ?? DEFAULT_OUT),
    signingKey: resolve(values['signing-key']),
    verificationKey: resolve(values['verification-key']),
    revision: values.revision ?? DEFAULT_REVISION,
  };
}

function mergedData(): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const name of DATA_FILES) {
    const file = join(AUTHZ_DIR, `${name}.json`);
    Object.assign(merged, JSON.parse(readFileSync(file, 'utf8')));
  }
  return merged;
}

function runOpa(args: string[]): void {
  const result = spawnSync(process.env.OPA_BIN ?? 'opa', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`opa ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
  }
}

function bundleCatalogueKeys(out: string): string[] {
  const result = spawnSync(
    process.env.OPA_BIN ?? 'opa',
    ['eval', '-b', out, 'object.keys(data.authz.catalogue)', '--format=json'],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(`opa eval failed: ${(result.stderr || result.stdout).trim()}`);
  }
  const parsed = JSON.parse(result.stdout) as {
    result?: Array<{ expressions: Array<{ value: unknown }> }>;
  };
  const keys = parsed.result?.[0]?.expressions?.[0]?.value;
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('the signed bundle has no data.authz.catalogue');
  }
  return keys as string[];
}

function buildBundle(options: Options): string[] {
  const staging = mkdtempSync(join(tmpdir(), 'authz-bundle-'));
  try {
    cpSync(AUTHZ_DIR, join(staging, 'authz'), { recursive: true });
    writeFileSync(join(staging, 'authz', 'data.json'), `${JSON.stringify(mergedData(), null, 2)}\n`);

    mkdirSync(dirname(options.out), { recursive: true });
    runOpa([
      'build',
      '-b',
      '--signing-key',
      options.signingKey,
      '--signing-alg',
      'ES256',
      '--revision',
      options.revision,
      '-o',
      options.out,
      staging,
    ]);
    runOpa([
      'build',
      '-b',
      '--verification-key',
      options.verificationKey,
      '--signing-alg',
      'ES256',
      '-o',
      '/dev/null',
      options.out,
    ]);
    return bundleCatalogueKeys(options.out);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

const options = parseOptions(process.argv.slice(2));
const keys = buildBundle(options);
console.log(`built and signed ${options.out} (revision ${options.revision}, ${keys.length} capabilities)`);
