import { loadPolicy } from '@open-policy-agent/opa-wasm';
import type { LoadedPolicy } from '@open-policy-agent/opa-wasm';
import { AUTHZ_TABLE_NAMES } from './tables';
import type { AuthzInput, Capabilities } from './types';

/**
 * Loads and evaluates the shared policy compiled to WASM. The artifact is
 * fetched from this app's own origin; the manifest names the content-hashed
 * wasm and the static tables the browser must supply with its runtime config.
 * This is the only place the raw OPA-WASM engine shape is touched.
 */

const POLICY_BASE = `${import.meta.env.BASE_URL}policy/`;

interface PolicyManifest {
  wasm: string;
  data: string;
}

interface PolicyBundle {
  policy: LoadedPolicy;
  tables: Record<string, unknown>;
}

let bundlePromise: Promise<PolicyBundle> | null = null;

/** Drops the cached policy so a Retry re-fetches and re-loads it. */
export function resetPolicy(): void {
  bundlePromise = null;
}

function getBundle(): Promise<PolicyBundle> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const manifestResponse = await fetch(`${POLICY_BASE}manifest.json`, { cache: 'no-store' });
      if (!manifestResponse.ok) throw new Error('policy_manifest_unavailable');
      const manifest = (await manifestResponse.json()) as PolicyManifest;
      const [wasmResponse, dataResponse] = await Promise.all([
        fetch(`${POLICY_BASE}${manifest.wasm}`, { cache: 'no-store' }),
        fetch(`${POLICY_BASE}${manifest.data}`, { cache: 'no-store' }),
      ]);
      if (!wasmResponse.ok) throw new Error('policy_wasm_unavailable');
      if (!dataResponse.ok) throw new Error('policy_data_unavailable');
      const policy = await loadPolicy(await wasmResponse.arrayBuffer());
      const data = (await dataResponse.json()) as { authz?: unknown };
      const tables = data.authz;
      // A valid-JSON payload that lacks the static tables would otherwise evaluate
      // to an empty capability map and be cached as a ready policy, skipping the
      // fail-closed floor; validate the table payload before caching it.
      if (!tables || typeof tables !== 'object') throw new Error('policy_data_invalid');
      const bundleTables = tables as Record<string, unknown>;
      for (const name of AUTHZ_TABLE_NAMES) {
        const table = bundleTables[name];
        if (!table || typeof table !== 'object') throw new Error('policy_data_invalid');
      }
      return { policy, tables: bundleTables };
    })().catch(error => {
      bundlePromise = null;
      throw error;
    });
  }
  return bundlePromise;
}

export async function evaluateCapabilities(
  input: AuthzInput,
  config: Record<string, unknown>
): Promise<Capabilities> {
  const { policy, tables } = await getBundle();
  // `setData` replaces the whole document, so the static tables are supplied
  // again beside the provider's runtime config.
  policy.setData({ authz: { ...tables, config: { [input.provider]: config } } });
  const resultSet = policy.evaluate(input) as Array<{ result?: Capabilities }>;
  const result = resultSet[0]?.result;
  if (!result) throw new Error('policy_result_missing');
  return result;
}
