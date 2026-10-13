import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProvider } from '../../app/AppProvider';
import { configureMocks, resetMocks } from '../../mocks/api';
import { ForgotPassword } from '../ForgotPassword';

function renderForgot() {
  return render(
    <AppProvider initialScreen="forgot-password">
      <ForgotPassword />
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

describe('ForgotPassword', () => {
  it('renders the recovery select and provider chips', () => {
    renderForgot();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Okta')).toBeInTheDocument();
  });

  it('opens the recovery dropdown into its Open state', async () => {
    const user = userEvent.setup();
    renderForgot();
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('closes the recovery dropdown on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderForgot();
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('validates that an identity provider is chosen', async () => {
    const user = userEvent.setup();
    renderForgot();
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText('Choose an identity provider to continue.')).toBeInTheDocument();
  });

  it('submits a mocked reset once a provider is chosen and shows a success notice', async () => {
    const user = userEvent.setup();
    renderForgot();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'Okta' }));
    await user.type(screen.getByLabelText(/work email/i), 'orlando@agentic-advantage.example');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText(/password reset request sent/i)).toBeInTheDocument();
  });

  it('shows a retryable error notice when the reset request fails', async () => {
    configureMocks({ resetPasswordFailure: true });
    const user = userEvent.setup();
    renderForgot();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'Okta' }));
    await user.type(screen.getByLabelText(/work email/i), 'orlando@agentic-advantage.example');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
