import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { configureMocks, resetMocks } from './mocks/api';

beforeEach(() => {
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
});

describe('App navigation', () => {
  it('signs in with a provider and opens the Profile and Projects APIs', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /welcome to your workspace/i });

    await user.click(screen.getByRole('button', { name: /google workspace/i }));
    await screen.findByRole('heading', { name: /^welcome\.$/i });

    await user.click(await screen.findByRole('button', { name: /open profile api/i }));
    await screen.findByRole('heading', { name: /get to know your identity/i });
    await user.click(await screen.findByRole('button', { name: /run request/i }));
    await screen.findByText('200 OK');

    await user.click(screen.getByRole('button', { name: /try projects api/i }));
    await screen.findByRole('heading', { name: /your next call starts here/i });
  });

  it('opens Account & identity from the sidebar and signs out', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /welcome to your workspace/i });
    await user.click(screen.getByRole('button', { name: /google workspace/i }));
    await screen.findByRole('heading', { name: /^welcome\.$/i });

    await user.click(screen.getByRole('button', { name: /account & identity/i }));
    await screen.findByRole('heading', { name: /one account\. your identities\./i });

    await user.click(screen.getByRole('button', { name: /sign out/i }));
    await screen.findByRole('heading', { name: /welcome to your workspace/i });
  });

  it('signs in with the provider discovered for the SSO domain', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /welcome to your workspace/i });

    await user.type(screen.getByLabelText('Work email'), 'orlando.parish@agentic-advantage.example');
    await user.click(screen.getByRole('button', { name: /continue with sso/i }));
    await screen.findByRole('heading', { name: /^welcome\.$/i });

    expect(await screen.findByText('Signed in with Microsoft Entra ID')).toBeInTheDocument();
  });

  it('names the current screen in the document title', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(document.title).toBe('Sign in · Your Identity');
    await screen.findByRole('heading', { name: /welcome to your workspace/i });

    await user.click(screen.getByRole('button', { name: /google workspace/i }));
    await screen.findByRole('heading', { name: /^welcome\.$/i });
    expect(document.title).toBe('Overview · Your Identity');
  });

  it('keeps the chosen provider on the overview session', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /welcome to your workspace/i });

    await user.click(screen.getByRole('button', { name: /okta/i }));
    await screen.findByRole('heading', { name: /^welcome\.$/i });

    expect(await screen.findByText('Signed in with Okta')).toBeInTheDocument();
    expect(screen.queryByText(/signed in with google workspace/i)).not.toBeInTheDocument();
  });

  it('navigates from Change password to Forgot password', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /welcome to your workspace/i });

    await user.click(screen.getByRole('button', { name: /^change password$/i }));
    await screen.findByRole('heading', { name: /^change password$/i });

    await user.click(screen.getByRole('button', { name: /forgot your current password/i }));
    await screen.findByRole('heading', { name: /^forgot password\?$/i });
  });
});
