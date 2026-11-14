import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Downloads the pinned authz-policy release and contract into gitignored
 * directories and verifies them against the published manifest. The pin lives
 * in `policy/VERSION`; the command never changes it, and `--latest` only
 * reports the newest tag. Run with `bun run sync:policy`.
 */

const REPO = 'oparish1/authz-policy';
const CONTRACT = 'ghcr.io/oparish1/authz-policy/authz-contract';
const AUTH_HELP =
  'set GH_TOKEN to a token with read access to oparish1/authz-policy or run `gh auth login`';

const MODULE_DIR = (import.meta as unknown as { dir?: string }).dir;
const FRONTEND_DIR = MODULE_DIR ? join(MODULE_DIR, '..') : process.cwd();
const DEFAULT_VERSION_DIR = join(FRONTEND_DIR, 'policy');
const DEFAULT_OUT_DIR = join(FRONTEND_DIR, 'public', 'policy');
export const DEFAULT_CONTRACT_DIR = join(FRONTEND_DIR, 'policy', 'contract');

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => CommandResult;

const defaultRun: CommandRunner = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.error?.message ?? result.stderr ?? '',
  };
};

export interface VerifiedArtifacts {
  version: string;
  policyHash: string;
  dataHash: string;
}

export interface VerifiedContract {
  capabilityIds: string[];
  reasonPrecedence: string[];
}

/** Reads the pinned version from `policy/VERSION` (or a test directory). */
export function readVersion(versionDir = DEFAULT_VERSION_DIR): string {
  const file = join(versionDir, 'VERSION');
  if (!existsSync(file)) throw new Error(`${file} is missing`);
  const version = readFileSync(file, 'utf8').trim();
  if (!version) throw new Error(`${file} is empty`);
  return version;
}

function readArtifact(dir: string, name: string): Buffer {
  const file = join(dir, name);
  if (!existsSync(file)) throw new Error(`${name} is missing from ${dir}`);
  return readFileSync(file);
}

function parseArtifactJson(dir: string, name: string): unknown {
  const raw = readArtifact(dir, name).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireFileEntry(
  files: Record<string, unknown>,
  name: string,
  manifestFile: string
): { sha256: string; bytes: number } {
  const entry = files[name];
  if (!isRecord(entry)) throw new Error(`${manifestFile} does not describe ${name}`);
  const { sha256, bytes } = entry;
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(sha256)) {
    throw new Error(`${manifestFile} has an invalid sha256 for ${name}`);
  }
  if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes < 0) {
    throw new Error(`${manifestFile} has an invalid byte count for ${name}`);
  }
  return { sha256: sha256.toLowerCase(), bytes };
}

function verifyFile(
  dir: string,
  name: string,
  entry: { sha256: string; bytes: number },
  manifestFile: string
): string {
  const content = readArtifact(dir, name);
  const hash = createHash('sha256').update(content).digest('hex');
  if (hash !== entry.sha256) {
    throw new Error(`${name} sha256 ${hash} does not match ${manifestFile}`);
  }
  if (content.byteLength !== entry.bytes) {
    throw new Error(`${name} has ${content.byteLength} bytes, not the ${entry.bytes} in ${manifestFile}`);
  }
  return hash;
}

/** Verifies the downloaded artifacts against the manifest and the pinned version. */
export function verifyArtifacts(dir: string, version: string): VerifiedArtifacts {
  const manifestFile = 'manifest.json';
  const manifest = parseArtifactJson(dir, manifestFile);
  if (!isRecord(manifest)) throw new Error(`${manifestFile} is not an object`);
  if (manifest.version !== version) {
    throw new Error(
      `${manifestFile} version ${String(manifest.version)} does not match the pinned ${version}`
    );
  }
  if (!isRecord(manifest.files)) throw new Error(`${manifestFile} has no files object`);
  const policyEntry = requireFileEntry(manifest.files, 'policy.wasm', manifestFile);
  const dataEntry = requireFileEntry(manifest.files, 'data.json', manifestFile);
  const policyHash = verifyFile(dir, 'policy.wasm', policyEntry, manifestFile);
  const dataHash = verifyFile(dir, 'data.json', dataEntry, manifestFile);
  return { version, policyHash, dataHash };
}

/** Downloads the pinned release assets with `gh`; the runner is injectable for tests. */
export function downloadRelease(version: string, dir: string, run: CommandRunner = defaultRun): void {
  mkdirSync(dir, { recursive: true });
  const result = run('gh', [
    'release',
    'download',
    `v${version}`,
    '-R',
    REPO,
    '-D',
    dir,
    '--clobber',
    '-p',
    'policy.wasm',
    '-p',
    'data.json',
    '-p',
    'manifest.json',
  ]);
  if (result.status !== 0) {
    throw new Error(`could not download authz-policy v${version} (${AUTH_HELP})`);
  }
}

/** Downloads and extracts the pinned `authz-contract` package with `oras`. */
export function downloadContract(
  version: string,
  dir: string,
  run: CommandRunner = defaultRun
): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const pull = run('oras', ['pull', `${CONTRACT}:${version}`, '-o', dir]);
  if (pull.status !== 0) {
    throw new Error(
      `could not download the authz contract v${version} (is oras installed? run \`bun run sync:policy\` again)`
    );
  }
  const tarball = join(dir, 'authz-contract.tar.gz');
  const extract = run('tar', ['-xzf', tarball, '-C', dir]);
  if (extract.status !== 0) {
    throw new Error(`could not extract the authz contract v${version} (${tarball})`);
  }
  rmSync(tarball, { force: true });
}

function requireStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`${name} must be an array of non-empty strings`);
  }
  return value;
}

/** Verifies the extracted contract carries the vocabulary and parity fixtures. */
export function verifyContract(dir: string): VerifiedContract {
  const file = join(dir, 'fixtures', 'capability-ids.json');
  const raw = parseArtifactJson(dir, join('fixtures', 'capability-ids.json'));
  if (!isRecord(raw)) throw new Error(`${file} is not an object`);
  const capabilityIds = requireStringArray(raw.capability_ids, `${file} capability_ids`);
  const reasonPrecedence = requireStringArray(raw.reason_precedence, `${file} reason_precedence`);
  for (const name of ['personas.json', 'matrix.snapshot.json']) {
    parseArtifactJson(dir, join('fixtures', name));
  }
  return { capabilityIds, reasonPrecedence };
}

/** Fails when the release catalogue omits a capability the contract publishes. */
export function verifyCatalogue(
  dir: string,
  version: string,
  capabilityIds: readonly string[]
): void {
  const data = parseArtifactJson(dir, 'data.json');
  const catalogue =
    isRecord(data) && isRecord(data.authz) && isRecord(data.authz.catalogue)
      ? data.authz.catalogue
      : null;
  if (!catalogue) throw new Error('data.json has no authz.catalogue object');
  const missing = capabilityIds.filter(capability => !Object.hasOwn(catalogue, capability));
  if (missing.length > 0) {
    throw new Error(`pinned policy v${version} is missing capability ${missing[0]} in data.json`);
  }
}

/** Reads the latest tag without changing the pin. */
export function latestTag(run: CommandRunner = defaultRun): string {
  // `gh release view` with no tag reports the latest release; the `--latest`
  // flag does not exist on this CLI version.
  const result = run('gh', ['release', 'view', '-R', REPO, '--json', 'tagName', '--jq', '.tagName']);
  if (result.status !== 0) {
    throw new Error(`could not read the latest authz-policy release (${AUTH_HELP})`);
  }
  const tag = result.stdout.trim();
  if (!tag) throw new Error('gh returned no tag for the latest authz-policy release');
  return tag;
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  run: CommandRunner = defaultRun
): Promise<void> {
  if (argv.includes('--latest')) {
    console.log(latestTag(run));
    return;
  }
  const version = readVersion();
  downloadRelease(version, DEFAULT_OUT_DIR, run);
  const { policyHash, dataHash } = verifyArtifacts(DEFAULT_OUT_DIR, version);
  downloadContract(version, DEFAULT_CONTRACT_DIR, run);
  const { capabilityIds } = verifyContract(DEFAULT_CONTRACT_DIR);
  verifyCatalogue(DEFAULT_OUT_DIR, version, capabilityIds);
  console.log(`synced authz-policy v${version} policy.wasm ${policyHash} data.json ${dataHash}`);
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
