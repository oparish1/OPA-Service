import { render } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPermissions, refreshCapabilities } from '../engine';
import { resetPolicy } from '../policy';
import { getSnapshot } from '../store';
import { useCan } from '../useCan';
import { setAppConfig } from '../../config';
import { log } from '../../lib/log';
import { setProviderRegistry } from '../../providers/active';
import type { FrontendProviderModule, ProviderSession } from '../../providers/types';
import { clearSession, setSession } from '../../session/store';
import type { Session } from '../../types';

const REPO_ROOT = new URL('../../../../../', import.meta.url).pathname.replace(/^\/@fs/, '');
const POLICY_DIR = join(REPO_ROOT, 'frontend', 'public', 'policy');
const MANIFEST_PATH = join(POLICY_DIR, 'manifest.json');
const HAS_ARTIFACT = existsSync(MANIFEST_PATH);

const PROVIDER_SESSION: ProviderSession = {
  providerId: 'entra',
  providerName: 'Entra',
  issuer: 'https://login.example/tenant/v2.0',
  account: null,
  rawClaims: { sub: 'subject-1', roles: ['Workspace.User'] },
  accessToken: { value: 'token-value', expiresAt: '—', scopes: 'workspace:read' },
};

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

function provider(): FrontendProviderModule {
  return {
    id: 'entra',
    name: 'Entra',
    ssoDomain: 'agentic-advantage.example',
    links: {},
    renderIcon: (_size: number): ReactNode => null,
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
    authz: {
      claims: () => ({
        roles: ['Workspace.User'],
        groups: [],
        scopes: ['workspace:read'],
        tenant: 'tenant-1',
        hd: '',
        email_verified: false,
        has_subject: true,
      }),
      config: () => ({ tenant: 'tenant-1' }),
    },
  };
}

function configure(enabled = true): void {
  setAppConfig({
    gatewayUrl: 'https://localhost:9080',
    authz: { enabled },
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

/** Serves the on-disk wasm artifact and its static data over the fetch surface. */
function servingFetch(): ReturnType<typeof vi.fn> {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { wasm: string; data: string };
  const wasm = readFileSync(join(POLICY_DIR, manifest.wasm));
  const data = JSON.parse(readFileSync(join(POLICY_DIR, manifest.data), 'utf8'));
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('manifest.json')) return { ok: true, json: async () => manifest };
    if (url.endsWith(manifest.wasm)) {
      return {
        ok: true,
        arrayBuffer: async () =>
          wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
      };
    }
    if (url.endsWith(manifest.data)) return { ok: true, json: async () => data };
    return { ok: false, status: 404 };
  });
}

/** Loads one sample to reach the shared prototype, then counts its evaluations. */
async function spyOnEvaluate() {
  const { loadPolicy } = await import('@open-policy-agent/opa-wasm');
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { wasm: string };
  const wasm = readFileSync(join(POLICY_DIR, manifest.wasm));
  const sample = await loadPolicy(
    wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)
  );
  return vi.spyOn(Object.getPrototypeOf(sample) as { evaluate: (...args: unknown[]) => unknown }, 'evaluate');
}

beforeEach(() => {
  configure();
  setProviderRegistry([provider()]);
  setSession(CORE_SESSION);
});

afterEach(() => {
  clearSession();
  resetPolicy();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  log.clear();
});

describe('capability engine', () => {
  it.skipIf(!HAS_ARTIFACT)('evaluates once for the session and caches the result', async () => {
    vi.stubGlobal('fetch', servingFetch());
    await refreshCapabilities();
    expect(getSnapshot().status).toBe('ready');
    expect(getSnapshot().capabilities['nav.api.profile'].allowed).toBe(true);
  });

  it.skipIf(!HAS_ARTIFACT)('does not evaluate from a render or a re-render (A15)', async () => {
    vi.stubGlobal('fetch', servingFetch());
    const evaluate = await spyOnEvaluate();
    await refreshCapabilities();
    const afterRefresh = evaluate.mock.calls.length;
    expect(afterRefresh).toBeGreaterThan(0);

    function Probe() {
      const decision = useCan('nav.api.profile');
      return <span>{String(decision.allowed)}</span>;
    }
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(evaluate.mock.calls.length).toBe(afterRefresh);
  });

  it('fails closed to the baseline floor when the policy cannot load (A14)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network down'))));
    await refreshCapabilities();

    const snapshot = getSnapshot();
    expect(snapshot.status).toBe('error');
    expect(snapshot.capabilities['nav.overview'].allowed).toBe(true);
    expect(snapshot.capabilities['nav.account'].allowed).toBe(true);
    expect(snapshot.capabilities['nav.api.profile']).toEqual({
      allowed: false,
      reason: 'permissions_unavailable',
    });
    expect(snapshot.capabilities['action.api.send.write'].allowed).toBe(false);
  });

  it.skipIf(!HAS_ARTIFACT)('fails closed when the policy data artifact lacks the static tables (A20, R3)', async () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { wasm: string; data: string };
    const wasm = readFileSync(join(POLICY_DIR, manifest.wasm));
    const serveData = (data: unknown) =>
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('manifest.json')) return { ok: true, json: async () => manifest };
        if (url.endsWith(manifest.wasm)) {
          return {
            ok: true,
            arrayBuffer: async () => wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
          };
        }
        if (url.endsWith(manifest.data)) return { ok: true, json: async () => data };
        return { ok: false, status: 404 };
      });

    for (const malformed of [{}, { authz: { config: {} } }]) {
      resetPolicy();
      vi.stubGlobal('fetch', serveData(malformed));
      await refreshCapabilities();
      expect(getSnapshot().status).toBe('error');
      expect(getSnapshot().capabilities['nav.overview'].allowed).toBe(true);
      expect(getSnapshot().capabilities['nav.api.profile'].allowed).toBe(false);
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

  it.skipIf(!HAS_ARTIFACT)('drops the cached policy and the decisions on sign-out (A16)', async () => {
    const fetchMock = servingFetch();
    vi.stubGlobal('fetch', fetchMock);
    await refreshCapabilities();
    expect(getSnapshot().status).toBe('ready');
    const callsBefore = fetchMock.mock.calls.length;

    clearPermissions();
    expect(getSnapshot().status).toBe('disabled');

    await refreshCapabilities();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it.skipIf(!HAS_ARTIFACT)('does not repopulate after sign-out resolves a pending refresh (A16)', async () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { wasm: string; data: string };
    const wasm = readFileSync(join(POLICY_DIR, manifest.wasm));
    const data = JSON.parse(readFileSync(join(POLICY_DIR, manifest.data), 'utf8'));
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('manifest.json')) {
          await gate;
          return { ok: true, json: async () => manifest };
        }
        if (url.endsWith(manifest.wasm)) {
          return {
            ok: true,
            arrayBuffer: async () =>
              wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
          };
        }
        if (url.endsWith(manifest.data)) return { ok: true, json: async () => data };
        return { ok: false, status: 404 };
      })
    );

    const pending = refreshCapabilities();
    clearPermissions();
    release();
    await pending;

    expect(getSnapshot().status).toBe('disabled');
  });

  it('never logs a claim, token or input value (A22)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('policy evaluation failed'))));
    await refreshCapabilities();

    const serialized = JSON.stringify(log.recent());
    expect(serialized).not.toContain('token-value');
    expect(serialized).not.toContain('subject-1');
    expect(serialized).not.toContain('Workspace.User');
    consoleError.mockRestore();
  });
});
