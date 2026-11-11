import { describe, expect, it } from 'vitest';
import { CapabilitiesError, fetchCapabilities, parseCapabilities } from '../service';
import { capabilitiesWith } from '../testing';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('parseCapabilities', () => {
  it('accepts a full valid map', () => {
    const valid = capabilitiesWith({
      'nav.api.profile': { allowed: false, reason: 'missing_scope' },
    });
    expect(parseCapabilities(valid)).toEqual(valid);
  });

  it('normalizes an allowed decision to an empty reason', () => {
    const raw = capabilitiesWith({});
    (raw['nav.overview'] as { allowed: boolean; reason: string }).reason = 'missing_role';
    expect(parseCapabilities(raw)['nav.overview']).toEqual({ allowed: true, reason: '' });
  });

  it('rejects a map missing a capability', () => {
    const raw = capabilitiesWith({}) as Record<string, unknown>;
    delete raw['nav.api.profile'];
    expect(() => parseCapabilities(raw)).toThrow(CapabilitiesError);
  });

  it('rejects a non-boolean decision', () => {
    const raw = capabilitiesWith({}) as Record<string, unknown>;
    raw['nav.api.profile'] = { allowed: 'yes', reason: '' };
    expect(() => parseCapabilities(raw)).toThrow(CapabilitiesError);
  });

  it('rejects a denied decision with an unknown reason', () => {
    const raw = capabilitiesWith({}) as Record<string, unknown>;
    raw['nav.api.profile'] = { allowed: false, reason: 'made_up' };
    expect(() => parseCapabilities(raw)).toThrow(CapabilitiesError);
  });

  it('rejects a non-object body', () => {
    expect(() => parseCapabilities(null)).toThrow(CapabilitiesError);
    expect(() => parseCapabilities([])).toThrow(CapabilitiesError);
    expect(() => parseCapabilities('nope')).toThrow(CapabilitiesError);
  });
});

describe('fetchCapabilities', () => {
  const token = 'token-value';

  it('returns the parsed map on success', async () => {
    const body = capabilitiesWith({});
    const fetchImpl = async () => jsonResponse(body);
    await expect(fetchCapabilities('/entra/authz/capabilities', token, fetchImpl)).resolves.toEqual(
      body
    );
  });

  it('sends the bearer token and accepts JSON', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse(capabilitiesWith({}));
    };
    await fetchCapabilities('/entra/authz/capabilities', token, fetchImpl as typeof fetch);
    expect(calls[0]?.url).toBe('/entra/authz/capabilities');
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${token}`);
    expect(calls[0]?.init?.redirect).toBe('manual');
  });

  it('maps a non-2xx response to an http error code', async () => {
    const fetchImpl = async () => jsonResponse({ error: 'nope' }, 503);
    await expect(
      fetchCapabilities('/entra/authz/capabilities', token, fetchImpl as typeof fetch)
    ).rejects.toMatchObject({ code: 'capabilities_http_503' });
  });

  it('maps a rejected fetch to a fetch failure', async () => {
    const fetchImpl = async () => {
      throw new Error('network down');
    };
    await expect(
      fetchCapabilities('/entra/authz/capabilities', token, fetchImpl as typeof fetch)
    ).rejects.toMatchObject({ code: 'capabilities_fetch_failed' });
  });

  it('maps an unreadable body to a body error', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('bad json');
        },
      }) as unknown as Response;
    await expect(
      fetchCapabilities('/entra/authz/capabilities', token, fetchImpl as typeof fetch)
    ).rejects.toMatchObject({ code: 'capabilities_body_invalid' });
  });
});
