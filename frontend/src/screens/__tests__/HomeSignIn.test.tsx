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
  it('renders only the Microsoft Entra ID provider', () => {
    renderSignIn();
    expect(screen.getByText(/Continue with Microsoft Entra ID/)).toBeInTheDocument();
    expect(screen.queryByText(/Continue with Google Workspace/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Continue with Okta/)).not.toBeInTheDocument();
    expect(screen.queryByText('OR USE ORGANISATION SSO')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Work email')).not.toBeInTheDocument();
  });

  it('signs in with Entra and opens Overview', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /welcome to your workspace/i });
    await user.click(screen.getByRole('button', { name: /microsoft entra id/i }));
    await screen.findByRole('heading', { name: /^welcome\.$/i });
    expect(await screen.findByText('Signed in with Microsoft Entra ID')).toBeInTheDocument();
  });

  it('shows an in-progress provider and the sign-in failure copy with a retry', async () => {
    configureMocks({ latencyMs: 60, signInFailure: true });
    const user = userEvent.setup();
    renderSignIn();
    const provider = screen.getByRole('button', { name: /microsoft entra id/i });
    await user.click(provider);
    expect(provider).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('Sign-in failed. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
