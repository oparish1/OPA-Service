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

  it('runs a valid request straight to the projects success body', async () => {
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText(/prj_01/)).toBeInTheDocument();
  });

  it('runs a genuine 401 into the token-recovery state and recovers on refresh', async () => {
    configureMocks({ runRequestFailure: 'unauthorized' });
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    expect(await screen.findByText('401 Unauthorized')).toBeInTheDocument();
    expect(screen.getAllByText(/access token expired/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/your account is still connected/i)).toBeInTheDocument();

    configureMocks({ runRequestFailure: null });
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText(/prj_01/)).toBeInTheDocument();
  });

  it('shows the empty projects body', async () => {
    configureMocks({ runRequestFailure: 'unauthorized', projectsEmpty: true });
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    await screen.findByText('401 Unauthorized');
    configureMocks({ runRequestFailure: null });
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    expect(await screen.findByText('Nothing to show yet')).toBeInTheDocument();
    expect(screen.getByText('200 OK')).toBeInTheDocument();
  });

  it('shows a server error as a retryable notice after a valid-token run', async () => {
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
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
    configureMocks({ runRequestFailure: 'unauthorized' });
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    await screen.findByText('401 Unauthorized');
    configureMocks({ refreshTokenFailure: true });
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    expect(await screen.findByText('Refresh token expired. Sign in again.')).toBeInTheDocument();
  });

  it('shows an editable URL with the app default and a fixed GET method', async () => {
    renderProjects();
    await screen.findByText('Run the request to see the response');
    expect(screen.getByRole('textbox', { name: 'Request URL' })).toHaveValue(
      `${window.location.origin}/v1/projects`
    );
    expect(screen.getByText('GET')).toBeInTheDocument();
  });

  it('lists the four Authorization options in order with the session entry default', async () => {
    const user = userEvent.setup();
    renderProjects();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Bearer · demo_at_op…9b4e',
      'Bearer valid-token-123',
      'Bearer expired-token',
      'no-token',
    ]);
  });

  it('shows the input error and sends nothing for an invalid URL', async () => {
    const user = userEvent.setup();
    renderProjects();
    await screen.findByText('Run the request to see the response');
    const field = screen.getByRole('textbox', { name: 'Request URL' });
    await user.clear(field);
    await user.type(field, 'not a url');
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('Enter a valid http or https URL.')).toBeInTheDocument();
    expect(screen.getByText('Run the request to see the response')).toBeInTheDocument();
  });

  it('shows a non-session 401 normally without the recovery panel', async () => {
    const user = userEvent.setup();
    renderProjects();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Bearer expired-token'));
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('401 Unauthorized')).toBeInTheDocument();
    expect(screen.queryByText(/your account is still connected/i)).not.toBeInTheDocument();
  });

  it('does not show the demo disclaimer', async () => {
    renderProjects();
    await screen.findByText('Run the request to see the response');
    expect(
      screen.queryByText(/No live API request or token refresh was performed/i)
    ).not.toBeInTheDocument();
  });

  it('runs the GET against the URL typed in the field', async () => {
    const user = userEvent.setup();
    renderProjects();
    await screen.findByText('Run the request to see the response');
    const field = screen.getByRole('textbox', { name: 'Request URL' });
    await user.clear(field);
    await user.type(field, `${window.location.origin}/v1/me`);
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText(/orlando.parish@agadv.example/)).toBeInTheDocument();
    expect(screen.queryByText(/prj_01/)).not.toBeInTheDocument();
  });

  it('re-enables refresh after a run supersedes an in-flight refresh', async () => {
    configureMocks({ runRequestFailure: 'unauthorized' });
    const user = userEvent.setup();
    renderProjects();
    await runRequest(user);
    await screen.findByText('401 Unauthorized');
    configureMocks({ runRequestFailure: null, latencyMs: 300 });
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    configureMocks({ latencyMs: 0 });
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 700));
    configureMocks({ runRequestFailure: 'unauthorized' });
    await user.click(screen.getByRole('button', { name: /run request/i }));
    await screen.findByText('401 Unauthorized');
    expect(screen.getByRole('button', { name: /refresh token & retry/i })).not.toBeDisabled();
  });
});
