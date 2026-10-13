import { render, screen, waitFor } from '@testing-library/react';
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
  it('shows a loading skeleton then the identities', async () => {
    const { container } = renderAccount();
    expect(container.querySelectorAll('.aa-skeleton').length).toBeGreaterThan(0);
    expect(await screen.findByText('Microsoft Entra ID')).toBeInTheDocument();
    expect(screen.getByText('Account active')).toBeInTheDocument();
  });

  it('shows the empty-providers state with a Connect action', async () => {
    configureMocks({ identitiesEmpty: true });
    renderAccount();
    expect(await screen.findByText('No identity providers connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('shows a connect button in progress while linking', async () => {
    configureMocks({ latencyMs: 60 });
    const user = userEvent.setup();
    renderAccount();
    await screen.findByText('Microsoft Entra ID');
    const connect = screen.getAllByRole('button', { name: 'Connect' })[0];
    await user.click(connect);
    expect(connect).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(connect).not.toHaveAttribute('aria-busy'));
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
    await user.click(screen.getAllByRole('button', { name: 'Manage' })[0]);
    expect(open).toHaveBeenCalledWith(
      'https://example.com/manage/microsoft',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
