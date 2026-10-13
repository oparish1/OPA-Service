import { useState } from 'react';
import { useApp } from '../app/app-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RecoveryResponse } from '../components/RecoveryResponse';
import { RequestPanel } from '../components/RequestPanel';
import { ResponseCard } from '../components/ResponseCard';
import { SkeletonBlock } from '../components/Skeleton';
import { useAsyncData } from '../hooks/useAsyncData';
import { GENERIC_ERROR } from '../lib/copy';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { getSession, refreshToken, runRequest } from '../mocks/api';
import { EXPIRED_ACCESS_TOKEN, MOCK_SESSION, PROJECTS_ENDPOINT } from '../mocks/data';
import type { ApiResponse } from '../mocks/types';
import { body, color, font } from '../styles/tokens';

interface RunState {
  response: ApiResponse;
  token: string;
  masked: string;
  expiresAt: string;
}

function projectsCount(body: unknown): number | null {
  if (body && typeof body === 'object' && 'projects' in body) {
    const projects = (body as { projects: unknown }).projects;
    if (Array.isArray(projects)) return projects.length;
  }
  return null;
}

/** Projects API — idle shell, 401 token recovery, refresh, and success/empty. */
export function ProjectsAPI() {
  const { signOut } = useApp();
  const { state, reload } = useAsyncData(getSession);
  const [run, setRun] = useState<RunState | null>(null);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  if (state.status === 'loading') {
    return (
      <WorkspaceLayout
        active="projects-api"
        breadcrumb="DOWNSTREAM APIs / PROJECTS"
        title="Your next call starts here."
      >
        <SkeletonBlock lines={4} />
      </WorkspaceLayout>
    );
  }

  if (state.status === 'error') {
    return (
      <WorkspaceLayout
        active="projects-api"
        breadcrumb="DOWNSTREAM APIs / PROJECTS"
        title="Your next call starts here."
      >
        <Notice
          tone="error"
          heading={GENERIC_ERROR}
          action={
            <Button variant="secondary" onClick={reload}>
              Retry
            </Button>
          }
        />
      </WorkspaceLayout>
    );
  }

  const session = state.data;
  const response = run?.response ?? null;
  const token = run?.token ?? EXPIRED_ACCESS_TOKEN;
  const masked = run?.masked ?? session.accessToken.masked;
  const expiresAt = run?.expiresAt ?? session.accessToken.expiresAt;
  const expired = response?.status === 401;
  const empty = response !== null && !expired && projectsCount(response.body) === 0;
  const failed =
    response !== null && response.status !== 401 && (response.status >= 400 || response.status === 0);

  async function handleRun() {
    setRunning(true);
    try {
      const result = await runRequest(token, PROJECTS_ENDPOINT);
      setRun({ response: result, token, masked, expiresAt });
    } finally {
      setRunning(false);
    }
  }

  async function handleRefresh() {
    setRefreshError(null);
    setRefreshing(true);
    try {
      const newToken = await refreshToken();
      const result = await runRequest(newToken.value, PROJECTS_ENDPOINT);
      setRun({
        response: result,
        token: newToken.value,
        masked: newToken.masked,
        expiresAt: newToken.expiresAt,
      });
    } catch {
      setRefreshError('Refresh token expired. Sign in again.');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <WorkspaceLayout
      active="projects-api"
      breadcrumb="DOWNSTREAM APIs / PROJECTS"
      title="Your next call starts here."
      statusBadge={expired ? <Badge tone="error">Access token expired</Badge> : undefined}
    >
      <p style={{ margin: 0, ...body[15], fontFamily: font.body, color: color.text.secondary }}>
        List workspace projects. This demo request shows an expired access token and how to recover.
      </p>

      <RequestPanel
        method="GET"
        endpoint={PROJECTS_ENDPOINT}
        tokenLabel={expired ? `Access token · expired at ${expiresAt}` : `Access token · valid until ${expiresAt}`}
        tokenOptions={[{ value: token, label: `Bearer · ${masked}` }]}
        tokenValue={token}
        onTokenChange={next => setRun(current => (current ? { ...current, token: next } : current))}
        tokenExpired={expired}
        running={running}
        onRun={handleRun}
      />

      {expired ? (
        <RecoveryResponse
          expiredAt={expiresAt}
          refreshValidUntil={MOCK_SESSION.refreshToken.expiresAt}
          refreshing={refreshing}
          error={refreshError}
          onRefresh={handleRefresh}
          onSignIn={signOut}
        />
      ) : null}

      {failed ? (
        <Notice
          tone="error"
          heading={GENERIC_ERROR}
          action={
            <Button variant="secondary" onClick={handleRun}>
              Retry
            </Button>
          }
        />
      ) : null}

      {empty ? <Notice tone="neutral">Nothing to show yet</Notice> : null}

      <ResponseCard response={response} />

      <hr style={{ margin: 0, border: 'none', borderTop: `1px solid ${color.border.subtle}` }} />
      <span style={{ ...body[12], fontFamily: font.body, color: color.text.secondary }}>
        Demo error &amp; recovery actions · No live API request or token refresh was performed.
      </span>
    </WorkspaceLayout>
  );
}
