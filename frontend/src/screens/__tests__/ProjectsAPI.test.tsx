import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProvider } from '../../app/AppProvider';
import { configureMocks, resetMocks } from '../../mocks/api';
import { ProjectsAPI } from '../ProjectsAPI';

function renderProjects() {
  return render(
    <AppProvider initialScreen="projects-api">
      <ProjectsAPI />
    </AppProvider>
  );
}

async function runRequest(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Run the request to see the response');
  await user.click(screen.getByRole('button', { name: /run request/i }));
}

beforeEach(() => {
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
});

describe('ProjectsAPI', () => {
  it('shows the idle ResponseCard placeholder before the request is run', async () => {
    renderProjects();
    expect(await screen.findByText('Run the request to see the response')).toBeInTheDocument();
  });

  it('runs the expired token request into the 401 token-recovery state', async () => {
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    expect(await screen.findByText('401 Unauthorized')).toBeInTheDocument();
    expect(screen.getAllByText(/access token expired/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/your account is still connected/i)).toBeInTheDocument();
  });

  it('refreshes the token and shows the projects success body', async () => {
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    await screen.findByText('401 Unauthorized');
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText(/prj_01/)).toBeInTheDocument();
  });

  it('shows the empty projects body', async () => {
    configureMocks({ projectsEmpty: true });
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    await screen.findByText('401 Unauthorized');
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    expect(await screen.findByText('Nothing to show yet')).toBeInTheDocument();
    expect(screen.getByText('200 OK')).toBeInTheDocument();
  });

  it('shows a server error as a retryable notice after a valid-token run', async () => {
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    await screen.findByText('401 Unauthorized');
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    await screen.findByText('200 OK');
    configureMocks({ runRequestFailure: 'server' });
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('500 Server Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows a network timeout as a retryable notice after a valid-token run', async () => {
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    await screen.findByText('401 Unauthorized');
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    await screen.findByText('200 OK');
    configureMocks({ runRequestFailure: 'timeout' });
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows a retryable error when the session fails to load', async () => {
    configureMocks({ getSessionFailure: true });
    renderProjects();
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('keeps the expired state when the refresh token has expired', async () => {
    configureMocks({ refreshTokenFailure: true });
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    await screen.findByText('401 Unauthorized');
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    expect(await screen.findByText('Refresh token expired. Sign in again.')).toBeInTheDocument();
  });
});
