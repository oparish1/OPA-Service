import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppProvider } from './AppProvider';
import { useApp } from './app-context';

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
});
