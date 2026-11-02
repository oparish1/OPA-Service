import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationError } from './components/ConfigurationError';
import { StartupError } from './components/StartupError';
import { loadAppConfig } from './config';
import { log } from './lib/log';

const VALID = {
  gatewayUrl: 'http://localhost:9080',
  logLevel: 'info',
  providers: [
    {
      id: 'entra',
      name: 'Microsoft Entra ID',
      clientId: 'spa-client-id',
      issuer: 'https://login.microsoftonline.com/tenant/v2.0',
    },
  ],
};

function fetchReturning(body: string, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(body, { status })) as unknown as typeof fetch;
}

beforeEach(() => {
  log.clear();
});

describe('loadAppConfig', () => {
  it('loads a valid config and its log level', async () => {
    const result = await loadAppConfig({
      fetchImpl: fetchReturning(JSON.stringify(VALID)),
      baseUrl: 'http://app/',
    });
    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') expect(result.config.logLevel).toBe('info');
  });

  it('reports a missing config instead of starting the mock demo', async () => {
    const result = await loadAppConfig({
      fetchImpl: fetchReturning('', 404),
      baseUrl: 'http://app/',
    });
    expect(result).toMatchObject({ status: 'error', reason: 'missing' });
    expect(log.recent()[0].level).toBe('error');
  });

  it('reports an HTML response as not JSON', async () => {
    const result = await loadAppConfig({
      fetchImpl: fetchReturning('<!doctype html><html></html>'),
      baseUrl: 'http://app/',
    });
    expect(result).toMatchObject({ status: 'error', reason: 'not-json' });
  });

  it('reports malformed JSON', async () => {
    const result = await loadAppConfig({
      fetchImpl: fetchReturning('{"gatewayUrl":'),
      baseUrl: 'http://app/',
    });
    expect(result).toMatchObject({ status: 'error', reason: 'not-json' });
  });

  it('reports a secret-shaped value', async () => {
    const result = await loadAppConfig({
      fetchImpl: fetchReturning(
        JSON.stringify({
          ...VALID,
          providers: [{ ...VALID.providers[0], clientId: 'A'.repeat(48) }],
        })
      ),
      baseUrl: 'http://app/',
    });
    expect(result).toMatchObject({ status: 'error', reason: 'secret' });
  });

  it('reports an invalid log level', async () => {
    const result = await loadAppConfig({
      fetchImpl: fetchReturning(JSON.stringify({ ...VALID, logLevel: 'verbose' })),
      baseUrl: 'http://app/',
    });
    expect(result).toMatchObject({ status: 'error', reason: 'invalid' });
  });

  it('reports a network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await loadAppConfig({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      baseUrl: 'http://app/',
    });
    expect(result).toMatchObject({ status: 'error', reason: 'network' });
  });

  it('reports a non-404, non-OK response as an HTTP reason', async () => {
    const result = await loadAppConfig({
      fetchImpl: fetchReturning('nope', 500),
      baseUrl: 'http://app/',
    });
    expect(result).toMatchObject({ status: 'error', reason: 'http' });
  });

  it('reports a body-read failure as network, not invalid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: () => Promise.reject(new Error('connection reset')),
    });
    const result = await loadAppConfig({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      baseUrl: 'http://app/',
    });
    expect(result).toMatchObject({ status: 'error', reason: 'network' });
  });
});

describe('ConfigurationError', () => {
  it('shows the reason class and the reference', () => {
    render(<ConfigurationError reason="not-json" message="config.json is not valid JSON" reference="ab12cd" />);
    expect(screen.getByText('Configuration error')).toBeInTheDocument();
    expect(screen.getByText('Reason: not-json')).toBeInTheDocument();
    expect(screen.getByText('Reference: ab12cd')).toBeInTheDocument();
  });

  it('shows a startup failure without blaming config.json (R8)', () => {
    render(<StartupError message="The application could not start." reference="ab12cd" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Reference: ab12cd')).toBeInTheDocument();
    expect(screen.queryByText(/config\.json/)).not.toBeInTheDocument();
  });
});
