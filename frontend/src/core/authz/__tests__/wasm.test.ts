import { loadPolicy } from '@open-policy-agent/opa-wasm';
import type { LoadedPolicy } from '@open-policy-agent/opa-wasm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNNER_TIMEOUT_MS } from '../../../../../shared/request-runner';
import { capabilitiesWith } from '../testing';
import type { AuthzClaims } from '../types';
import { CapabilitiesError, evaluateCapabilities, parseCapabilities, resetPolicy } from '../wasm';

vi.mock('@open-policy-agent/opa-wasm', () => ({ loadPolicy: vi.fn() }));

const CLAIMS: AuthzClaims = {
  roles: [],
  groups: [],
  scopes: [],
  tenant: '',
  hd: '',
  email_verified: false,
  has_subject: false,
};
const CONFIG = { tenant: 'tenant-1' };
const TABLES = { catalogue: {}, roles: {}, role_map: {}, routes: {} };
const ENTRYPOINT = 'authz/capabilities';

function manifestResponse(body: unknown = { entrypoint: ENTRYPOINT }) {
  return { ok: true, json: async () => body };
}

function wasmResponse(ok = true) {
  return { ok, arrayBuffer: async () => new ArrayBuffer(0) };
}

function dataResponse(body: unknown = { authz: TABLES }, ok = true) {
  return { ok, json: async () => body };
}

function servingFetch(
  options: {
    manifest?: unknown;
    manifestOk?: boolean;
    wasmOk?: boolean;
    data?: unknown;
    dataOk?: boolean;
  } = {}
): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('manifest.json')) {
      return options.manifestOk === false
        ? { ok: false, status: 404 }
        : manifestResponse(options.manifest);
    }
    if (url.endsWith('policy.wasm')) return wasmResponse(options.wasmOk !== false);
    if (url.endsWith('data.json')) {
      return dataResponse(options.data, options.dataOk !== false);
    }
    return { ok: false, status: 404 };
  });
}

function fakePolicy(): {
  setData: ReturnType<typeof vi.fn>;
  evaluate: ReturnType<typeof vi.fn>;
} {
  return {
    setData: vi.fn(),
    evaluate: vi.fn(() => [{ result: capabilitiesWith({}) }]),
  };
}

beforeEach(() => {
  resetPolicy();
  vi.mocked(loadPolicy).mockReset();
});

afterEach(() => {
  resetPolicy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('evaluateCapabilities', () => {
  it('rejects a missing manifest', async () => {
    vi.stubGlobal('fetch', servingFetch({ manifestOk: false }));
    await expect(evaluateCapabilities('entra', CLAIMS, CONFIG)).rejects.toThrow(
      'policy_manifest_unavailable'
    );
  });

  it('rejects a manifest without an entrypoint', async () => {
    vi.stubGlobal('fetch', servingFetch({ manifest: {} }));
    await expect(evaluateCapabilities('entra', CLAIMS, CONFIG)).rejects.toThrow(
      'policy_manifest_invalid'
    );
  });

  it('rejects a non-OK wasm fetch', async () => {
    vi.stubGlobal('fetch', servingFetch({ wasmOk: false }));
    await expect(evaluateCapabilities('entra', CLAIMS, CONFIG)).rejects.toThrow(
      'policy_wasm_unavailable'
    );
  });

  it('rejects a non-OK data fetch', async () => {
    vi.stubGlobal('fetch', servingFetch({ dataOk: false }));
    await expect(evaluateCapabilities('entra', CLAIMS, CONFIG)).rejects.toThrow(
      'policy_data_unavailable'
    );
  });

  it('rejects a data payload missing a static table', async () => {
    vi.stubGlobal('fetch', servingFetch({ data: { authz: { catalogue: {} } } }));
    await expect(evaluateCapabilities('entra', CLAIMS, CONFIG)).rejects.toThrow(
      'policy_data_invalid'
    );
  });

  it('sets the provider config and returns the parsed map', async () => {
    const policy = fakePolicy();
    vi.mocked(loadPolicy).mockResolvedValue(policy as unknown as LoadedPolicy);
    vi.stubGlobal('fetch', servingFetch());
    const result = await evaluateCapabilities('entra', CLAIMS, CONFIG);

    expect(policy.setData).toHaveBeenCalledWith({
      authz: { ...TABLES, config: { entra: CONFIG } },
    });
    expect(policy.evaluate).toHaveBeenCalledWith({ provider: 'entra', claims: CLAIMS }, ENTRYPOINT);
    expect(result).toEqual(capabilitiesWith({}));
  });

  it('aborts a policy fetch that never responds so the caller fails closed', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          })
      )
    );

    const pending = evaluateCapabilities('entra', CLAIMS, CONFIG);
    const expectation = expect(pending).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(RUNNER_TIMEOUT_MS);
    await expectation;
  });

  it('drops the cached bundle after a failure so a retry reloads it', async () => {
    const policy = fakePolicy();
    vi.mocked(loadPolicy).mockResolvedValue(policy as unknown as LoadedPolicy);
    const fetchMock = servingFetch({ wasmOk: false });
    vi.stubGlobal('fetch', fetchMock);
    await expect(evaluateCapabilities('entra', CLAIMS, CONFIG)).rejects.toThrow();

    vi.stubGlobal('fetch', servingFetch());
    await evaluateCapabilities('entra', CLAIMS, CONFIG);
    expect(loadPolicy).toHaveBeenCalledTimes(1);
  });
});

describe('parseCapabilities', () => {
  it('accepts a full map and normalizes the allowed reason', () => {
    const parsed = parseCapabilities(
      capabilitiesWith({ 'nav.api.profile': { allowed: false, reason: 'missing_scope' } })
    );
    expect(parsed['nav.overview']).toEqual({ allowed: true, reason: '' });
    expect(parsed['nav.api.profile']).toEqual({ allowed: false, reason: 'missing_scope' });
  });

  it('rejects a missing capability', () => {
    const incomplete = capabilitiesWith({}) as Record<string, unknown>;
    delete incomplete['nav.api.profile'];
    expect(() => parseCapabilities(incomplete)).toThrow(CapabilitiesError);
  });

  it('rejects a non-boolean decision', () => {
    expect(() => parseCapabilities({ 'nav.overview': { allowed: 'yes' } })).toThrow(
      CapabilitiesError
    );
  });

  it('rejects an unknown deny reason', () => {
    expect(() =>
      parseCapabilities({
        ...capabilitiesWith({}),
        'nav.api.profile': { allowed: false, reason: 'nope' },
      })
    ).toThrow(CapabilitiesError);
  });

  it('rejects a non-object body', () => {
    for (const body of [null, 'body', 42, []]) {
      expect(() => parseCapabilities(body)).toThrow(CapabilitiesError);
    }
  });
});
