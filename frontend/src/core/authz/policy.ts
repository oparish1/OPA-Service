import { loadPolicy } from '@open-policy-agent/opa-wasm';
import type { LoadedPolicy } from '@open-policy-agent/opa-wasm';
import type { AuthzInput, Capabilities } from './types';

/**
 * Loads and evaluates the shared policy compiled to WASM. The artifact is
 * fetched from this app's own origin; the manifest names the content-hashed
 * file. This is the only place the raw OPA-WASM engine shape is touched.
 */

const POLICY_BASE = `${import.meta.env.BASE_URL}policy/`;

interface PolicyManifest {
  wasm: string;
}

let policyPromise: Promise<LoadedPolicy> | null = null;

/** Drops the cached policy so a Retry re-fetches and re-loads it. */
export function resetPolicy(): void {
  policyPromise = null;
}

async function fetchWasm(): Promise<ArrayBuffer> {
  const manifestResponse = await fetch(`${POLICY_BASE}manifest.json`, { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error('policy_manifest_unavailable');
  const manifest = (await manifestResponse.json()) as PolicyManifest;
  const wasmResponse = await fetch(`${POLICY_BASE}${manifest.wasm}`, { cache: 'no-store' });
  if (!wasmResponse.ok) throw new Error('policy_wasm_unavailable');
  return wasmResponse.arrayBuffer();
}

function getPolicy(): Promise<LoadedPolicy> {
  if (!policyPromise) {
    policyPromise = (async () => loadPolicy(await fetchWasm()))().catch(error => {
      policyPromise = null;
      throw error;
    });
  }
  return policyPromise;
}

export async function evaluateCapabilities(
  input: AuthzInput,
  config: Record<string, unknown>
): Promise<Capabilities> {
  const policy = await getPolicy();
  policy.setData({ authz: { config: { [input.provider]: config } } });
  const resultSet = policy.evaluate(input) as Array<{ result?: Capabilities }>;
  const result = resultSet[0]?.result;
  if (!result) throw new Error('policy_result_missing');
  return result;
}
