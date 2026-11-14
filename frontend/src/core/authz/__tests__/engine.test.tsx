import { loadPolicy } from '@open-policy-agent/opa-wasm';
import type { LoadedPolicy } from '@open-policy-agent/opa-wasm';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAppConfig } from '../../config';
import { log } from '../../lib/log';
import { setProviderRegistry } from '../../providers/active';
import type { FrontendProviderModule, ProviderSession } from '../../providers/types';
import { clearSession, setSession } from '../../session/store';
import type { Session } from '../../types';
import { clearPermissions, refreshCapabilities } from '../engine';
import { getSnapshot } from '../store';
import { capabilitiesWith } from '../testing';
import type { AuthzClaims } from '../types';
import { useCan } from '../useCan';

vi.mock('@open-policy-agent/opa-wasm', () => ({ loadPolicy: vi.fn() }));

const loadPolicyMock = vi.mocked(loadPolicy);

const CORE_SESSION: Session = {
  provider: 'Entra',
  providerId: 'entra',
  account: null,
  accessToken: { value: 'token-value', masked: 'tok…ue', expiresAt: '—', scopes: 'workspace:read' },
  refreshToken: { value: '', masked: '', expiresAt: '—', grant: '—' },
  issuer: 'https://login.example/tenant/v2.0',
  issuedAt: '—',
  snapshot: 'entra · —',
};

const PROVIDER_SESSION: ProviderSession = {
  providerId: 'entra',
  providerName: 'Entra',
  issuer: 'https://login.example/tenant/v2.0',
  account: null,
  rawClaims: {},
  accessToken: { value: 'token-value', expiresAt: '—', scopes: 'workspace:read' },
};

const WASM_CLAIMS: AuthzClaims = {
  roles: ['Workspace.User'],
  groups: [],
  scopes: ['workspace:read'],
  tenant: 'tenant-1',
  hd: '',
  email_verified: false,
  has_subject: true,
};

const WASM_CONFIG = { tenant: 'tenant-1' };

function providerModule(): FrontendProviderModule {
  return {
    id: 'entra',
    name: 'Entra',
    ssoDomain: 'agentic-advantage.example',
    links: {},
    renderIcon: () => null,
    auth: {
      async signIn() {},
      async handleRedirect() {
        return 'ignored';
      },
      async getAccessToken() {
        return 'token-value';
      },
      async renew() {
        return false;
      },
      async signOut() {},
      session: () => PROVIDER_SESSION,
    },
    authz: { claims: () => WASM_CLAIMS, config: () => WASM_CONFIG },
  };
}

function configure(enabled = true, mode: 'gateway' | 'wasm' = 'gateway'): void {
  setAppConfig({
    gatewayUrl: 'https://localhost:9080',
    authz: { enabled, mode },
    providers: [
      {
        id: 'entra',
        name: 'Entra',
        clientId: 'client-id',
        issuer: 'https://login.example/tenant/v2.0',
        tenant: 'tenant-1',
      },
    ],
  });
}

/** Serves one capability map over the fetch surface. */
function servingFetch(
  body: unknown = capabilitiesWith({}),
  status = 200
): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

const TABLES = { catalogue: {}, roles: {}, role_map: {}, routes: {} };

/** Serves the synced policy artifact over the fetch surface. */
function wasmServingFetch(
  overrides: { wasmOk?: boolean; data?: unknown } = {}
): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('manifest.json')) {
      return { ok: true, json: async () => ({ entrypoint: 'authz/capabilities' }) };
    }
    if (url.endsWith('policy.wasm')) {
      return { ok: overrides.wasmOk !== false, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    if (url.endsWith('data.json')) {
      return { ok: true, json: async () => ({ authz: overrides.data ?? TABLES }) };
    }
    return { ok: false, status: 404 };
  });
}

function wasmPolicy(result: unknown = capabilitiesWith({})): {
  setData: ReturnType<typeof vi.fn>;
  evaluate: ReturnType<typeof vi.fn>;
} {
  return { setData: vi.fn(), evaluate: vi.fn(() => [{ result }]) };
}

function expectBaselineFloor(): void {
  const snapshot = getSnapshot();
  expect(snapshot.status).toBe('error');
  expect(snapshot.capabilities['nav.overview'].allowed).toBe(true);
  expect(snapshot.capabilities['nav.account'].allowed).toBe(true);
  expect(snapshot.capabilities['nav.api.profile']).toEqual({
    allowed: false,
    reason: 'permissions_unavailable',
  });
  expect(snapshot.capabilities['action.api.send.write'].allowed).toBe(false);
}

beforeEach(() => {
  configure();
  setProviderRegistry([providerModule()]);
  setSession(CORE_SESSION);
  loadPolicyMock.mockReset();
});

afterEach(() => {
  clearPermissions();
  clearSession();
  setProviderRegistry([]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  log.clear();
});

describe('capability engine', () => {
  it('fetches once for the session and caches the map', async () => {
    const fetchMock = servingFetch(
      capabilitiesWith({ 'nav.api.profile': { allowed: false, reason: 'missing_scope' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    await refreshCapabilities();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://localhost:9080/entra/authz/capabilities');
    expect(getSnapshot().status).toBe('ready');
    expect(getSnapshot().capabilities['nav.api.profile']).toEqual({
      allowed: false,
      reason: 'missing_scope',
    });
  });

  it('does not fetch from a render or a re-render (A15)', async () => {
    const fetchMock = servingFetch();
    vi.stubGlobal('fetch', fetchMock);
    await refreshCapabilities();

    function Probe() {
      const decision = useCan('nav.api.profile');
      return <span>{String(decision.allowed)}</span>;
    }
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed to the baseline floor when the fetch rejects (A14)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('capabilities fetch failed')))
    );
    await refreshCapabilities();
    expectBaselineFloor();
  });

  it('fails closed on a non-2xx response', async () => {
    vi.stubGlobal('fetch', servingFetch({ error: 'nope' }, 503));
    await refreshCapabilities();
    expectBaselineFloor();
  });

  it('fails closed on an incomplete or invalid body', async () => {
    const incomplete = capabilitiesWith({}) as Record<string, unknown>;
    delete incomplete['nav.api.profile'];
    for (const body of [incomplete, { 'nav.overview': { allowed: 'yes' } }, null]) {
      vi.stubGlobal('fetch', servingFetch(body));
      await refreshCapabilities();
      expectBaselineFloor();
    }
  });

  it('loads nothing when authz is disabled (A17)', async () => {
    configure(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await refreshCapabilities();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSnapshot().status).toBe('disabled');
  });

  it('loads nothing without a session', async () => {
    clearSession();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await refreshCapabilities();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSnapshot().status).toBe('disabled');
  });

  it('does not repopulate after sign-out resolves a pending refresh (A16)', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await gate;
        return { ok: true, status: 200, json: async () => capabilitiesWith({}) };
      })
    );

    const pending = refreshCapabilities();
    clearPermissions();
    release();
    await pending;

    expect(getSnapshot().status).toBe('disabled');
  });

  it('evaluates the synced policy in wasm mode', async () => {
    configure(true, 'wasm');
    const policy = wasmPolicy(
      capabilitiesWith({ 'nav.api.profile': { allowed: false, reason: 'missing_scope' } })
    );
    loadPolicyMock.mockResolvedValue(policy as unknown as LoadedPolicy);
    vi.stubGlobal('fetch', wasmServingFetch());
    await refreshCapabilities();

    expect(policy.setData).toHaveBeenCalledWith({
      authz: { ...TABLES, config: { entra: WASM_CONFIG } },
    });
    expect(policy.evaluate).toHaveBeenCalledWith(
      { provider: 'entra', claims: WASM_CLAIMS },
      'authz/capabilities'
    );
    expect(getSnapshot().status).toBe('ready');
    expect(getSnapshot().capabilities['nav.api.profile']).toEqual({
      allowed: false,
      reason: 'missing_scope',
    });
  });

  it('fails closed in wasm mode when the policy cannot load (A14)', async () => {
    configure(true, 'wasm');
    vi.stubGlobal('fetch', wasmServingFetch({ wasmOk: false }));
    await refreshCapabilities();
    expectBaselineFloor();
  });

  it('loads nothing when authz is disabled in wasm mode (A17)', async () => {
    configure(false, 'wasm');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await refreshCapabilities();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSnapshot().status).toBe('disabled');
  });

  it('drops the cached policy on sign-out (A16)', async () => {
    configure(true, 'wasm');
    const policy = wasmPolicy();
    loadPolicyMock.mockResolvedValue(policy as unknown as LoadedPolicy);
    vi.stubGlobal('fetch', wasmServingFetch());
    await refreshCapabilities();
    expect(getSnapshot().status).toBe('ready');
    expect(loadPolicyMock).toHaveBeenCalledTimes(1);

    clearPermissions();
    expect(getSnapshot().status).toBe('disabled');
    await refreshCapabilities();
    expect(loadPolicyMock).toHaveBeenCalledTimes(2);
  });

  it('never logs the token or a capability value (A22)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('capabilities fetch failed')))
    );
    await refreshCapabilities();

    const serialized = JSON.stringify(log.recent());
    expect(serialized).not.toContain('token-value');
    expect(serialized).not.toContain('missing_scope');
    expect(serialized).not.toContain('nav.api.profile');
    consoleError.mockRestore();
  });
});
