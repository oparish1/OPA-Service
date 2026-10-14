import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../../app/AppProvider';
import { configureMocks, resetMocks } from '../../mocks/api';
import { AccountIdentity } from '../AccountIdentity';

function renderAccount() {
  return render(
    <AppProvider initialScreen="account">
      <AccountIdentity />
    </AppProvider>
  );
}

beforeEach(() => {
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
  vi.restoreAllMocks();
});

describe('AccountIdentity', () => {
  it('shows a loading skeleton then only the Entra identity', async () => {
    const { container } = renderAccount();
    expect(container.querySelectorAll('.aa-skeleton').length).toBeGreaterThan(0);
    expect(await screen.findByText('Microsoft Entra ID')).toBeInTheDocument();
    expect(screen.getByText('Account active')).toBeInTheDocument();
    expect(screen.queryByText('Okta')).not.toBeInTheDocument();
    expect(screen.queryByText(/Google Workspace/)).not.toBeInTheDocument();
    expect(screen.queryByText('Organisation SSO')).not.toBeInTheDocument();
  });

  it('shows the empty-providers state without a Connect action', async () => {
    configureMocks({ identitiesEmpty: true });
    renderAccount();
    expect(await screen.findByText('No identity providers connected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
  });

  it('shows a retryable error when the identities fail to load', async () => {
    configureMocks({ getIdentitiesFailure: true });
    renderAccount();
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('opens a manage URL in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderAccount();
    await screen.findByText('Microsoft Entra ID');
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    expect(open).toHaveBeenCalledWith(
      'https://example.com/manage/microsoft',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
