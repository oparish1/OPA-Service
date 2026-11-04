import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProvider } from '../../app/AppProvider';
import { ScreenRouter } from '../../App';
import { AUTHZ_REASON_COPY } from '../../lib/copy';
import { configureMocks, resetMocks } from '../../mocks/api';
import { AccountIdentity } from '../../screens/AccountIdentity';
import { ProfileAPI } from '../../screens/ProfileAPI';
import { setError } from '../store';
import { capabilitiesWith, resetCapabilities, seedCapabilities } from '../testing';

function renderProfile() {
  return render(
    <AppProvider initialScreen="overview">
      <ProfileAPI />
    </AppProvider>
  );
}

beforeEach(() => {
  resetMocks();
  configureMocks({ latencyMs: 0 });
  resetCapabilities();
});

afterEach(() => {
  resetMocks();
  resetCapabilities();
});

describe('advisory UI authorization', () => {
  it('hides a denied nav item and disables the run button with an accessible reason (A12, A20)', async () => {
    seedCapabilities(
      capabilitiesWith({
        'nav.api.profile': { allowed: false, reason: 'missing_scope' },
        'action.api.send.read': { allowed: false, reason: 'missing_scope' },
      })
    );
    renderProfile();
    await screen.findByText('Run the request to see the response');

    expect(screen.queryByRole('button', { name: 'Profile API' })).not.toBeInTheDocument();

    const run = screen.getByRole('button', { name: /run request/i });
    expect(run).toHaveAttribute('aria-disabled', 'true');
    expect(run).not.toBeDisabled();
    const describedBy = run.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      AUTHZ_REASON_COPY.missing_scope
    );
  });

  it('shows the nav item and enables the run button when allowed (A12)', async () => {
    seedCapabilities(capabilitiesWith({}));
    renderProfile();
    await screen.findByText('Run the request to see the response');

    expect(screen.getByRole('button', { name: 'Profile API' })).toBeInTheDocument();
    const run = screen.getByRole('button', { name: /run request/i });
    expect(run).not.toHaveAttribute('aria-disabled');
    expect(run).not.toBeDisabled();
  });

  it('does not start a denied request from the URL field on Enter (A12)', async () => {
    seedCapabilities(
      capabilitiesWith({
        'nav.api.profile': { allowed: false, reason: 'missing_scope' },
        'action.api.send.read': { allowed: false, reason: 'missing_scope' },
      })
    );
    renderProfile();
    await screen.findByText('Run the request to see the response');

    await userEvent.type(screen.getByRole('textbox', { name: 'Request URL' }), '{Enter}');

    expect(screen.queryByText('Request authorised')).not.toBeInTheDocument();
    expect(screen.getByText('Run the request to see the response')).toBeInTheDocument();
  });

  it('shows the access-denied screen for a denied direct route (A13)', async () => {
    seedCapabilities(capabilitiesWith({ 'nav.api.profile': { allowed: false, reason: 'missing_role' } }));
    render(
      <AppProvider initialScreen="profile-api">
        <ScreenRouter />
      </AppProvider>
    );
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('shows the load-failure notice with Retry and keeps the baseline floor (A14)', async () => {
    setError();
    renderProfile();
    await screen.findByText('Run the request to see the response');

    expect(screen.getAllByText('Permissions could not be loaded.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run request/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('lists every capability with approved copy and never a raw code (A18, A19)', async () => {
    seedCapabilities(
      capabilitiesWith({ 'nav.api.projects': { allowed: false, reason: 'missing_group' } })
    );
    render(
      <AppProvider initialScreen="account">
        <AccountIdentity />
      </AppProvider>
    );
    await screen.findByText('Test Provider');

    expect(screen.getByText('Your permissions')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(AUTHZ_REASON_COPY.missing_group))).toBeInTheDocument();
    expect(screen.queryByText('missing_group')).not.toBeInTheDocument();
    expect(screen.queryByText('wrong_domain')).not.toBeInTheDocument();
  });
});
