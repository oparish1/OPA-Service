import { loadPolicy } from '@open-policy-agent/opa-wasm';
import type { LoadedPolicy } from '@open-policy-agent/opa-wasm';
import { AUTHZ_TABLE_NAMES } from '../../../../shared/authz-tables';
import { AUTHZ_REASONS, CAPABILITY_IDS } from './generated';
import type { AuthzClaims, AuthzReason, Capabilities, Decision } from './types';

/**
 * Loads and evaluates the policy the sync command downloaded into `public/policy`.
 * The artifact is served from this app's own origin; the manifest names the
 * entrypoint and the static tables the browser must supply with its runtime
 * config. This is the only place the raw OPA-WASM engine shape is touched.
 */

const POLICY_BASE = `${import.meta.env.BASE_URL}policy/`;

interface PolicyManifest {
  entrypoint: string;
}

interface PolicyBundle {
  policy: LoadedPolicy;
  entrypoint: string;
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
      if (typeof manifest.entrypoint !== 'string' || manifest.entrypoint.length === 0) {
        throw new Error('policy_manifest_invalid');
      }
      const [wasmResponse, dataResponse] = await Promise.all([
        fetch(`${POLICY_BASE}policy.wasm`, { cache: 'no-store' }),
        fetch(`${POLICY_BASE}data.json`, { cache: 'no-store' }),
      ]);
      if (!wasmResponse.ok) throw new Error('policy_wasm_unavailable');
      if (!dataResponse.ok) throw new Error('policy_data_unavailable');
      const policy = await loadPolicy(await wasmResponse.arrayBuffer());
      const data = (await dataResponse.json()) as { authz?: unknown };
      const tables = data.authz;
      // A valid-JSON payload that lacks the static tables would otherwise evaluate
      // to an empty capability map and be cached as a ready policy, skipping the
      // fail-closed floor; validate the table payload before caching it.
      if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
        throw new Error('policy_data_invalid');
      }
      const bundleTables = tables as Record<string, unknown>;
      for (const name of AUTHZ_TABLE_NAMES) {
        const table = bundleTables[name];
        if (!table || typeof table !== 'object' || Array.isArray(table)) {
          throw new Error('policy_data_invalid');
        }
      }
      return { policy, entrypoint: manifest.entrypoint, tables: bundleTables };
    })().catch(error => {
      bundlePromise = null;
      throw error;
    });
  }
  return bundlePromise;
}

function isAuthzReason(value: unknown): value is AuthzReason {
  return typeof value === 'string' && (AUTHZ_REASONS as readonly string[]).includes(value);
}

/** A stable failure code an operator can look up; never carries body content. */
export class CapabilitiesError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'CapabilitiesError';
    this.code = code;
  }
}

function parseDecision(value: unknown): Decision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CapabilitiesError('capabilities_body_invalid');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.allowed !== 'boolean') {
    throw new CapabilitiesError('capabilities_body_invalid');
  }
  if (record.allowed) return { allowed: true, reason: '' };
  if (!isAuthzReason(record.reason)) throw new CapabilitiesError('capabilities_body_invalid');
  return { allowed: false, reason: record.reason };
}

/** Requires every capability with a boolean decision and an allowed deny reason. */
export function parseCapabilities(raw: unknown): Capabilities {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CapabilitiesError('capabilities_body_invalid');
  }
  const record = raw as Record<string, unknown>;
  const result = {} as Capabilities;
  for (const capability of CAPABILITY_IDS) {
    result[capability] = parseDecision(record[capability]);
  }
  return result;
}

export async function evaluateCapabilities(
  providerId: string,
  claims: AuthzClaims,
  config: Record<string, unknown>
): Promise<Capabilities> {
  const { policy, entrypoint, tables } = await getBundle();
  // `setData` replaces the whole document, so the static tables are supplied
  // again beside the provider's runtime config.
  policy.setData({ authz: { ...tables, config: { [providerId]: config } } });
  const resultSet = policy.evaluate({ provider: providerId, claims }, entrypoint) as Array<{
    result?: unknown;
  }>;
  const result = resultSet[0]?.result;
  if (!result) throw new Error('policy_result_missing');
  return parseCapabilities(result);
}
