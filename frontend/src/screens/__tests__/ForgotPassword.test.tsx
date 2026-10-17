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
  it('renders the recovery select and provider chips for every enabled provider', async () => {
    renderForgot();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect((await screen.findAllByText('Microsoft Entra ID')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Okta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Google Workspace / Cloud Identity').length).toBeGreaterThan(0);
  });

  it('opens the recovery dropdown into its Open state', async () => {
    const user = userEvent.setup();
    renderForgot();
    await screen.findByText('Microsoft Entra ID');
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('closes the recovery dropdown on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderForgot();
    await screen.findByText('Microsoft Entra ID');
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
    await screen.findByText('Microsoft Entra ID');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'Microsoft Entra ID' }));
    await user.type(screen.getByLabelText(/work email/i), 'orlando@agentic-advantage.example');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText(/password reset request sent/i)).toBeInTheDocument();
    expect(await screen.findByText('https://example.com/reset')).toBeInTheDocument();
  });

  it('shows a retryable error notice when the reset request fails', async () => {
    configureMocks({ resetPasswordFailure: true });
    const user = userEvent.setup();
    renderForgot();
    await screen.findByText('Microsoft Entra ID');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'Microsoft Entra ID' }));
    await user.type(screen.getByLabelText(/work email/i), 'orlando@agentic-advantage.example');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows a retryable error notice when the provider list cannot be loaded', async () => {
    configureMocks({ getProvidersFailure: true });
    renderForgot();
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});