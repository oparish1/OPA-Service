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

  it('shows an editable URL with the app default and a fixed GET method', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    const field = screen.getByRole('textbox', { name: 'Request URL' });
    expect(field).toHaveValue(`${window.location.origin}/v1/me`);
    expect(screen.getByText('GET')).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, 'http://localhost:3000/v1/me');
    expect(field).toHaveValue('http://localhost:3000/v1/me');
  });

  it('lists the four Authorization options in order with the session entry default', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Bearer · demo_at_op…9b4e');
    await user.click(trigger);
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Bearer · demo_at_op…9b4e',
      'Bearer valid-token-123',
      'Bearer expired-token',
      'no-token',
    ]);
  });

  it('shows the input error and sends nothing for an invalid URL', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    const field = screen.getByRole('textbox', { name: 'Request URL' });
    await user.clear(field);
    await user.type(field, 'not a url');
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('Enter a valid http or https URL.')).toBeInTheDocument();
    expect(screen.queryByText('200 OK')).not.toBeInTheDocument();
    expect(screen.getByText('Run the request to see the response')).toBeInTheDocument();
  });

  it('runs the request when Enter is pressed in a valid URL field', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('textbox', { name: 'Request URL' }));
    await user.keyboard('{Enter}');
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
  });

  it('shows a non-session 401 normally without the recovery panel', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Bearer expired-token'));
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('401 Unauthorized')).toBeInTheDocument();
    expect(screen.queryByText(/your account is still connected/i)).not.toBeInTheDocument();
  });

  it('does not reinterpret a non-session 401 when the session option is selected', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Bearer expired-token'));
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('401 Unauthorized')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Bearer · demo_at/ }));
    expect(screen.queryByText(/your account is still connected/i)).not.toBeInTheDocument();
  });

  it('clears the previous response when a new run starts', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('button', { name: /run request/i }));
    await screen.findByText('200 OK');
    configureMocks({ runRequestFailure: 'server', latencyMs: 300 });
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(screen.queryByText('200 OK')).not.toBeInTheDocument();
    expect(await screen.findByText('500 Server Error')).toBeInTheDocument();
  });

  it('does not show the demo disclaimer', async () => {
    renderProfile();
    await screen.findByText('Run the request to see the response');
    expect(screen.queryByText(/No live request was made/i)).not.toBeInTheDocument();
  });

  it('runs the GET against the URL typed in the field', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    const field = screen.getByRole('textbox', { name: 'Request URL' });
    await user.clear(field);
    await user.type(field, `${window.location.origin}/v1/projects`);
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText(/prj_01/)).toBeInTheDocument();
    expect(screen.queryByText(/orlando.parish@agadv.example/)).not.toBeInTheDocument();
  });

  it('repeats the failed run URL on refresh & retry, not the edited field', async () => {
    configureMocks({ runRequestFailure: 'unauthorized' });
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    const field = screen.getByRole('textbox', { name: 'Request URL' });
    await user.clear(field);
    await user.type(field, `${window.location.origin}/v1/projects`);
    await user.click(screen.getByRole('button', { name: /run request/i }));
    expect(await screen.findByText('401 Unauthorized')).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, `${window.location.origin}/v1/me`);
    configureMocks({ runRequestFailure: null });
    await user.click(screen.getByRole('button', { name: /refresh token & retry/i }));
    expect(await screen.findByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText(/prj_01/)).toBeInTheDocument();
  });

  it('keeps the latest response when a superseded run resolves last', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    const field = screen.getByRole('textbox', { name: 'Request URL' });
    await user.clear(field);
    await user.type(field, `${window.location.origin}/v1/projects`);
    configureMocks({ latencyMs: 400 });
    await user.click(screen.getByRole('button', { name: /run request/i }));
    await user.clear(field);
    await user.type(field, `${window.location.origin}/v1/me`);
    configureMocks({ latencyMs: 0 });
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/orlando.parish@agadv.example/)).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(screen.getByText(/orlando.parish@agadv.example/)).toBeInTheDocument();
    expect(screen.queryByText(/prj_01/)).not.toBeInTheDocument();
  });

  it('re-enables refresh after a run supersedes an in-flight refresh', async () => {
    configureMocks({ runRequestFailure: 'unauthorized' });
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Run the request to see the response');
    await user.click(screen.getByRole('button', { name: /run request/i }));
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
