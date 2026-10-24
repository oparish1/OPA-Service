import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { AppProvider } from '../../app/AppProvider';
import { configureMocks, resetMocks } from '../../mocks/api';
import { setProviderRegistry } from '../../providers/active';
import { ALPHA_MODULE, BETA_MODULE } from '../../testing/fixtures';
import { TEST_PROVIDER_MODULE } from '../../testing/providers';
import { HomeSignIn } from '../HomeSignIn';

function renderSignIn() {
  return render(
    <AppProvider initialScreen="sign-in">
      <HomeSignIn />
    </AppProvider>
  );
}

beforeEach(() => {
  setProviderRegistry([TEST_PROVIDER_MODULE]);
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
});

describe('HomeSignIn', () => {
  it('renders one button per enabled provider in order', async () => {
    setProviderRegistry([ALPHA_MODULE, BETA_MODULE]);
    renderSignIn();
    expect(await screen.findByText(/Continue with Alpha Identity/)).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    const labels = buttons
      .map(button => button.textContent ?? '')
      .filter(label => label.startsWith('Continue with'));
    expect(labels).toEqual(['Continue with Alpha Identity', 'Continue with Beta Identity']);
    expect(screen.queryByText('OR USE ORGANISATION SSO')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Work email')).not.toBeInTheDocument();
  });

  it('signs in with the active provider and opens Overview', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /welcome to your workspace/i });
    await user.click(await screen.findByRole('button', { name: /test provider/i }));
    await screen.findByRole('heading', { name: /^welcome\.$/i });
    expect(await screen.findByText('Signed in with Test Provider')).toBeInTheDocument();
  });

  it('shows an in-progress provider and the sign-in failure copy with a retry', async () => {
    configureMocks({ latencyMs: 60, signInFailure: true });
    const user = userEvent.setup();
    renderSignIn();
    const provider = await screen.findByRole('button', { name: /test provider/i });
    await user.click(provider);
    expect(provider).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('Sign-in failed. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
