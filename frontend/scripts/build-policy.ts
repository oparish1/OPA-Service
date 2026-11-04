import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROVIDER_IDS } from '../../shared/providers';

/**
 * Compiles the shared `policy/authz/` Rego to WebAssembly for the browser. The
 * gateway imports the same package directly, so the two sides cannot drift. The
 * output is a content-hashed `.wasm` plus a manifest the browser reads to find
 * it; both are build artifacts and are never committed.
 */

// Bun provides `import.meta.dir`; the fallback keeps the module usable when the
// tests import it under Vite's transformed `import.meta`.
const MODULE_DIR =
  (import.meta as unknown as { dir?: string }).dir ?? process.cwd();
const REPO_ROOT = join(MODULE_DIR, '..', '..');
const DEFAULT_OUT_DIR = join(MODULE_DIR, '..', 'public', 'policy');
const DEFAULT_BUDGET_BYTES = 1024 * 1024;
const ENTRYPOINT = 'authz/capabilities';

/** The public config every provider compares against; each reads only its own fields. */
const VALIDATION_CONFIG = Object.fromEntries(
  PROVIDER_IDS.map(id => [
    id,
    {
      tenant: 'validation-tenant',
      required_role: 'validation-role',
      required_group: 'validation-group',
      hosted_domain: 'validation.example',
    },
  ])
);

/**
 * Representative inputs that reach every provider and both sides of its
 * allow/deny paths. `opa build` accepts a built-in the WASM target cannot
 * execute, so each provider must be evaluated before the artifact is written.
 */
const VALIDATION_INPUTS = [
  ...PROVIDER_IDS.map(provider => ({
    provider,
    claims: {
      has_subject: true,
      roles: ['validation-role'],
      groups: ['validation-group'],
      scopes: ['workspace:read', 'workspace:write'],
      tenant: 'validation-tenant',
      hd: 'validation.example',
      email_verified: true,
    },
    request: { method: 'GET' },
  })),
  ...PROVIDER_IDS.map(provider => ({
    provider,
    claims: {
      has_subject: false,
      roles: [],
      groups: [],
      scopes: [],
      tenant: '',
      hd: '',
      email_verified: false,
    },
    request: { method: 'POST' },
  })),
];

export interface BuildPolicyOptions {
  opaBin?: string;
  repoRoot?: string;
  outDir?: string;
  budgetBytes?: number;
  /** Directory holding the shared `authz` package; tests point this at a fixture. */
  policyDir?: string;
}

export interface PolicyArtifacts {
  wasmFile: string;
  manifestFile: string;
  sha256: string;
  bytes: number;
}

/** The OPA binary: an explicit path, `OPA_BIN`, or `opa` on `PATH`. */
export function locateOpa(explicit?: string): string | null {
  if (explicit) return explicit;
  if (process.env.OPA_BIN) return process.env.OPA_BIN;
  const which = spawnSync('which', ['opa'], { encoding: 'utf8' });
  if (which.status === 0) {
    const found = which.stdout.trim();
    if (found) return found;
  }
  return null;
}

export function assertWithinBudget(wasm: Uint8Array, budgetBytes = DEFAULT_BUDGET_BYTES): void {
  if (wasm.byteLength > budgetBytes) {
    throw new Error(`policy wasm is ${wasm.byteLength} bytes, over the ${budgetBytes}-byte budget`);
  }
}

/**
 * `opa build` succeeds even for a built-in the WASM target cannot execute, so
 * the artifact is loaded and evaluated before it can be written.
 */
async function validateWasm(wasm: Uint8Array): Promise<void> {
  const { loadPolicy } = await import('@open-policy-agent/opa-wasm');
  const policy = await loadPolicy(wasm);
  policy.setData({ authz: { config: VALIDATION_CONFIG } });
  for (const input of VALIDATION_INPUTS) policy.evaluate(input);
}

export async function buildPolicyWasm(options: BuildPolicyOptions = {}): Promise<Uint8Array> {
  const opa = locateOpa(options.opaBin);
  if (!opa) throw new Error('opa was not found; install OPA 1.4.2 or set OPA_BIN');
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const policyDir = options.policyDir ?? join(repoRoot, 'policy', 'authz');
  const work = mkdtempSync(join(tmpdir(), 'authz-policy-'));
  try {
    const bundle = join(work, 'bundle.tar.gz');
    const build = spawnSync(
      opa,
      ['build', '-t', 'wasm', '-e', ENTRYPOINT, '-o', bundle, policyDir],
      { encoding: 'utf8' }
    );
    if (build.status !== 0) {
      throw new Error(`opa build failed: ${(build.stderr || build.stdout).trim()}`);
    }
    const extract = spawnSync('tar', ['-xzf', bundle, '-C', work], { encoding: 'utf8' });
    if (extract.status !== 0) {
      throw new Error(`extracting the policy bundle failed: ${extract.stderr.trim()}`);
    }
    const wasm = new Uint8Array(readFileSync(join(work, 'policy.wasm')));
    assertWithinBudget(wasm, options.budgetBytes ?? DEFAULT_BUDGET_BYTES);
    await validateWasm(wasm);
    return wasm;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Writes the hashed wasm and its manifest, and removes any stale wasm file. */
export function writePolicyArtifacts(
  wasm: Uint8Array,
  outDir = DEFAULT_OUT_DIR
): PolicyArtifacts {
  mkdirSync(outDir, { recursive: true });
  const sha256 = createHash('sha256').update(wasm).digest('hex');
  const wasmFile = `authz.${sha256.slice(0, 8)}.wasm`;
  for (const entry of readdirSync(outDir)) {
    if (entry.startsWith('authz.') && entry.endsWith('.wasm') && entry !== wasmFile) {
      rmSync(join(outDir, entry), { force: true });
    }
  }
  writeFileSync(join(outDir, wasmFile), wasm);
  const manifestFile = 'manifest.json';
  const manifest = {
    entrypoint: ENTRYPOINT,
    wasm: wasmFile,
    sha256,
    bytes: wasm.byteLength,
  };
  writeFileSync(join(outDir, manifestFile), `${JSON.stringify(manifest, null, 2)}\n`);
  return { wasmFile, manifestFile, sha256, bytes: wasm.byteLength };
}

async function main(): Promise<void> {
  const outDir = process.env.AUTHZ_OUT_DIR ?? DEFAULT_OUT_DIR;
  const wasm = await buildPolicyWasm();
  const { wasmFile } = writePolicyArtifacts(wasm, outDir);
  console.log(`built ${wasmFile} (${wasm.byteLength} bytes)`);
}

if (import.meta.main) {
  await main();
}
