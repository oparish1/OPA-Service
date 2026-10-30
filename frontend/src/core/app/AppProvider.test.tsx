import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ABSOLUTE_LIMIT_MS,
  IDLE_LIMIT_MS,
  clearSession,
  setSession,
  setSessionLimits,
} from '../session/store';
import type { Session } from '../types';
import { AppProvider } from './AppProvider';
import { useApp } from './app-context';

const SESSION: Session = {
  provider: 'Microsoft Entra ID',
  providerId: 'entra',
  account: null,
  accessToken: { value: 'access-value', masked: 'ac…ue', expiresAt: 'soon', scopes: 'workspace:read' },
  refreshToken: { value: 'refresh-value', masked: 're…ue', expiresAt: 'later', grant: 'offline_access' },
  issuer: 'https://login.microsoftonline.com/tenant/v2.0',
  issuedAt: 'now',
  snapshot: 'entra · now',
};

afterEach(() => {
  clearSession();
  setSessionLimits({ idleMs: IDLE_LIMIT_MS, absoluteMs: ABSOLUTE_LIMIT_MS });
  vi.useRealTimers();
});

function Probe() {
  const { screen: current } = useApp();
  return <div>{current}</div>;
}

function SignOutProbe() {
  const { screen: current, signOut } = useApp();
  return (
    <div>
      <span>{current}</span>
      <button onClick={() => void signOut()}>Sign out</button>
    </div>
  );
}

describe('AppProvider', () => {
  it('lands on Overview when a session is bootstrapped on load', async () => {
    render(
      <AppProvider bootstrap={() => Promise.resolve(true)}>
        <Probe />
      </AppProvider>
    );
    expect(await screen.findByText('overview')).toBeInTheDocument();
  });

  it('stays on the initial screen when no session is bootstrapped', async () => {
    render(
      <AppProvider bootstrap={() => Promise.resolve(false)}>
        <Probe />
      </AppProvider>
    );
    expect(await screen.findByText('sign-in')).toBeInTheDocument();
  });

  it('keeps the current screen and surfaces an error when sign-out fails', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider
        initialScreen="overview"
        bootstrap={() => Promise.resolve(false)}
        signOut={() => Promise.reject(new Error('offline'))}
      >
        <SignOutProbe />
      </AppProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('overview')).toBeInTheDocument();
  });

  it('moves to the sign-in screen only after sign-out succeeds', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider
        initialScreen="overview"
        bootstrap={() => Promise.resolve(false)}
        signOut={() => Promise.resolve()}
      >
        <SignOutProbe />
      </AppProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('sign-in')).toBeInTheDocument();
  });

  it('returns to sign-in when the session expires (A7)', async () => {
    vi.useFakeTimers();
    setSessionLimits({ idleMs: 1000, absoluteMs: 100_000 });
    setSession(SESSION);
    render(
      <AppProvider bootstrap={() => Promise.resolve(true)} signOut={() => Promise.resolve()}>
        <Probe />
      </AppProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('overview')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('sign-in')).toBeInTheDocument();
  });
});
