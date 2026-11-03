import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProvider } from '../../app/AppProvider';
import { configureMocks, resetMocks } from '../../mocks/api';
import { setProviderRegistry } from '../../providers/active';
import { ALPHA_MODULE, BETA_MODULE } from '../../testing/fixtures';
import { ChangePassword } from '../ChangePassword';

function renderChange() {
  return render(
    <AppProvider initialScreen="change-password">
      <ChangePassword />
    </AppProvider>
  );
}

beforeEach(() => {
  setProviderRegistry([ALPHA_MODULE, BETA_MODULE]);
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
});

describe('ChangePassword', () => {
  it('shows the account detail and managed-by notice', async () => {
    renderChange();
    expect(await screen.findByText(/Demo User/)).toBeInTheDocument();
    expect(screen.getByText('Managed by your identity provider')).toBeInTheDocument();
  });

  it('does not fall back to the fixture account when the session cannot be loaded', async () => {
    configureMocks({ getSessionFailure: true });
    renderChange();
    expect(await screen.findByText('Managed by your identity provider')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Demo User/)).not.toBeInTheDocument());
  });

  it('validates that an identity provider is chosen', async () => {
    const user = userEvent.setup();
    renderChange();
    await user.click(screen.getByRole('button', { name: /change password/i }));
    expect(await screen.findByText('Choose an identity provider to continue.')).toBeInTheDocument();
  });

  it('submits a mocked change once a provider is chosen and shows a success notice', async () => {
    const user = userEvent.setup();
    renderChange();
    await screen.findByText(/Available identity providers:.*Alpha Identity/);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'Alpha Identity' }));
    await user.click(screen.getByRole('button', { name: /change password/i }));
    expect(await screen.findByText(/provider destination opened/i)).toBeInTheDocument();
    expect(await screen.findByText('https://example.com/change')).toBeInTheDocument();
  });

  it('shows a retryable error notice when the change request fails', async () => {
    configureMocks({ changePasswordFailure: true });
    const user = userEvent.setup();
    renderChange();
    await screen.findByText(/Available identity providers:.*Alpha Identity/);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'Alpha Identity' }));
    await user.click(screen.getByRole('button', { name: /change password/i }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows a retryable error notice when the provider list cannot be loaded', async () => {
    configureMocks({ getProvidersFailure: true });
    renderChange();
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
