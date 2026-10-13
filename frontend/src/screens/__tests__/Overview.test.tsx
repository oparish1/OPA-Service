import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../../app/AppProvider';
import { configureMocks, resetMocks } from '../../mocks/api';
import { Overview } from '../Overview';

function renderOverview() {
  return render(
    <AppProvider initialScreen="overview">
      <Overview />
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

describe('Overview', () => {
  it('shows the initial loading skeleton before the session loads', async () => {
    const { container } = renderOverview();
    expect(container.querySelectorAll('.aa-skeleton').length).toBeGreaterThan(0);
    expect(await screen.findByText('Access token')).toBeInTheDocument();
  });

  it('reveals and copies the access token', async () => {
    const user = userEvent.setup();
    renderOverview();
    await user.click((await screen.findAllByRole('button', { name: 'Reveal' }))[0]);
    expect(screen.getByText(/demo_at_op_20261010_orlando_parish_9b4e/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('resets a revealed token to masked when the session refreshes', async () => {
    const user = userEvent.setup();
    renderOverview();
    await user.click((await screen.findAllByRole('button', { name: 'Reveal' }))[0]);
    expect(screen.getByText(/demo_at_op_20261010_orlando_parish_9b4e/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /refresh session/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /refresh session/i })).not.toHaveAttribute('aria-busy')
    );
    expect(screen.queryByText(/demo_at_refreshed_20261010_orlando_parish_b21c/)).not.toBeInTheDocument();
    expect(screen.getByText('demo_at_refreshed…b21c')).toBeInTheDocument();
  });

  it('reports a failed clipboard write instead of claiming Copied', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    renderOverview();
    await user.click((await screen.findAllByRole('button', { name: 'Copy' }))[0]);
    expect(await screen.findByText('Copy failed')).toBeInTheDocument();
    expect(screen.queryByText('Copied')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the session fails to load', async () => {
    configureMocks({ getSessionFailure: true });
    renderOverview();
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('refreshes the session to a new access token', async () => {
    const user = userEvent.setup();
    renderOverview();
    await screen.findByRole('button', { name: /refresh session/i });
    await user.click(screen.getByRole('button', { name: /refresh session/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /refresh session/i })).not.toHaveAttribute('aria-busy')
    );
    await user.click(screen.getAllByRole('button', { name: 'Reveal' })[0]);
    expect(await screen.findByText(/demo_at_refreshed_20261010_orlando_parish_b21c/)).toBeInTheDocument();
  });

  it('shows the refresh button in progress while the session refreshes', async () => {
    configureMocks({ latencyMs: 60 });
    const user = userEvent.setup();
    renderOverview();
    const refresh = await screen.findByRole('button', { name: /refresh session/i });
    await user.click(refresh);
    expect(refresh).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(refresh).not.toHaveAttribute('aria-busy'));
  });

  it('shows an error notice and marks the access token expired when refresh fails', async () => {
    configureMocks({ refreshTokenFailure: true });
    const user = userEvent.setup();
    renderOverview();
    await screen.findByRole('button', { name: /refresh session/i });
    await user.click(screen.getByRole('button', { name: /refresh session/i }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(await screen.findByText('Expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh session/i })).toBeInTheDocument();
  });
});
