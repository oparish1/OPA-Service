import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { AppProvider } from '../../app/AppProvider';
import { configureMocks, resetMocks } from '../../mocks/api';
import { HomeSignIn } from '../HomeSignIn';

function renderSignIn() {
  return render(
    <AppProvider initialScreen="sign-in">
      <HomeSignIn />
    </AppProvider>
  );
}

beforeEach(() => {
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
});

describe('HomeSignIn', () => {
  it('renders the providers and the organisation SSO separator', () => {
    renderSignIn();
    expect(screen.getByText(/Continue with Microsoft Entra ID/)).toBeInTheDocument();
    expect(screen.getByText(/Continue with Google Workspace \/ Cloud Identity/)).toBeInTheDocument();
    expect(screen.getByText('OR USE ORGANISATION SSO')).toBeInTheDocument();
  });

  it('validates the SSO email', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /continue with sso/i }));
    expect(await screen.findByText('Please enter a valid work email address.')).toBeInTheDocument();
  });

  it('shows the unknown-domain input error', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText('Work email'), 'nobody@unknown.example');
    await user.click(screen.getByRole('button', { name: /continue with sso/i }));
    expect(await screen.findByText('No provider found for this domain')).toBeInTheDocument();
  });

  it('shows the network error notice for the offline domain', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText('Work email'), 'nobody@offline.example');
    await user.click(screen.getByRole('button', { name: /continue with sso/i }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows an in-progress provider and the sign-in failure copy', async () => {
    configureMocks({ latencyMs: 60, signInFailure: true });
    const user = userEvent.setup();
    renderSignIn();
    const provider = screen.getByRole('button', { name: /okta/i });
    await user.click(provider);
    expect(provider).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('Sign-in failed. Try again.')).toBeInTheDocument();
  });

  it('retries SSO with the corrected email after a network failure', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /welcome to your workspace/i });
    const email = screen.getByLabelText('Work email');
    await user.type(email, 'nobody@offline.example');
    await user.click(screen.getByRole('button', { name: /continue with sso/i }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();

    await user.clear(email);
    await user.type(email, 'orlando.parish@agentic-advantage.example');
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('heading', { name: /^welcome\.$/i })).toBeInTheDocument();
  });
});
