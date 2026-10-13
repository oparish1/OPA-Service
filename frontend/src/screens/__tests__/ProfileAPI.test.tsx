import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProvider } from '../../app/AppProvider';
import { configureMocks, resetMocks } from '../../mocks/api';
import { ProfileAPI } from '../ProfileAPI';

function renderProfile() {
  return render(
    <AppProvider initialScreen="profile-api">
      <ProfileAPI />
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

describe('ProfileAPI', () => {
  it('shows the idle ResponseCard placeholder before the request is run', async () => {
    renderProfile();
    expect(await screen.findByText('Run the request to see the response')).toBeInTheDocument();
    expect(screen.queryByText('200 OK')).not.toBeInTheDocument();
  });

  it('runs the request and shows the successful response', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText(/orlando.parish@agadv.example/)).toBeInTheDocument();
  });

  it('switches the response to the Headers tab', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('button', { name: /run request/i }));
    await screen.findByText('200 OK');
    await user.click(screen.getByRole('button', { name: /headers/i }));
    expect(screen.getByText('content-type: application/json')).toBeInTheDocument();
  });

  it('shows a server error as a retryable notice', async () => {
    configureMocks({ runRequestFailure: 'server' });
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('500 Server Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows the timeout network error with a retryable notice', async () => {
    configureMocks({ runRequestFailure: 'timeout' });
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(screen.getByText(/request_timeout/)).toBeInTheDocument();
    expect(screen.getByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('closes the token listbox on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('shows a retryable error when the session fails to load', async () => {
    configureMocks({ getSessionFailure: true });
    renderProfile();
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows the token recovery panel on 401 and recovers on refresh', async () => {
    configureMocks({ runRequestFailure: 'unauthorized' });
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('401 Unauthorized')).toBeInTheDocument();
    expect(screen.getByText(/your account is still connected/i)).toBeInTheDocument();
    configureMocks({ runRequestFailure: null });
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText(/valid until 10 Oct 2026 · 15:00:00 UTC/)).toBeInTheDocument();
  });
});
