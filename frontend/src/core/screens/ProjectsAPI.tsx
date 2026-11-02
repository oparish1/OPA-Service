import { useRef, useState } from 'react';
import { useApp } from '../app/app-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RecoveryResponse } from '../components/RecoveryResponse';
import { RequestPanel } from '../components/RequestPanel';
import { ResponseCard } from '../components/ResponseCard';
import { SkeletonBlock } from '../components/Skeleton';
import { useAsyncData } from '../hooks/useAsyncData';
import { BLOCKED_HOST, GENERIC_ERROR } from '../lib/copy';
import { describeError, log } from '../lib/log';
import { appUrl, PROJECTS_PATH, runnerAuthOptions, validateRunnerUrl } from '../lib/runner-url';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { getSession, refreshToken, runRequest } from '../api';
import type { ApiResponse, RunnerAuth } from '../types';
import { body, color, font } from '../styles/tokens';

function projectsCount(body: unknown): number | null {
  if (body && typeof body === 'object' && 'projects' in body) {
    const projects = (body as { projects: unknown }).projects;
    if (Array.isArray(projects)) return projects.length;
  }
  return null;
}

/** Projects API — idle shell, 401 token recovery, refresh and success/empty. */
export function ProjectsAPI() {
  const { signOut } = useApp();
  const { state, reload } = useAsyncData(getSession);
  const [url, setUrl] = useState(() => appUrl(PROJECTS_PATH));
  const [auth, setAuth] = useState<RunnerAuth>('session');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshReference, setRefreshReference] = useState<string | null>(null);
  const [accessMeta, setAccessMeta] = useState<{ masked: string; expiresAt: string } | null>(null);
  const [lastRun, setLastRun] = useState<{ url: string; auth: RunnerAuth } | null>(null);
  const runSeq = useRef(0);

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
          reference={state.reference}
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
  const masked = accessMeta?.masked ?? session.accessToken.masked;
  const expiresAt = accessMeta?.expiresAt ?? session.accessToken.expiresAt;
  const sessionExpired = response?.status === 401 && lastRun?.auth === 'session';
  const empty = response !== null && !sessionExpired && projectsCount(response.body) === 0;
  const failed =
    response !== null && response.status !== 401 && (response.status >= 400 || response.status === 0);

  async function handleRun() {
    const error = validateRunnerUrl(url);
    setUrlError(error);
    if (error) return;
    const runId = ++runSeq.current;
    const request = { url, auth };
    setRunning(true);
    setResponse(null);
    try {
      const result = await runRequest(request.auth, request.url);
      if (runSeq.current !== runId) return;
      setLastRun(request);
      setResponse(result);
    } finally {
      if (runSeq.current === runId) setRunning(false);
    }
  }

  async function handleRefresh() {
    const request = lastRun;
    if (!request) return;
    setRefreshError(null);
    setRefreshReference(null);
    setRefreshing(true);
    const runId = ++runSeq.current;
    try {
      const newToken = await refreshToken();
      setAccessMeta({ masked: newToken.masked, expiresAt: newToken.expiresAt });
      const result = await runRequest(request.auth, request.url);
      if (runSeq.current !== runId) return;
      setResponse(result);
    } catch (error) {
      if (runSeq.current !== runId) return;
      const reference = log.error('projects-api', 'Token refresh failed', {
        error: describeError(error),
      });
      setRefreshReference(reference);
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
      statusBadge={sessionExpired ? <Badge tone="error">Access token expired</Badge> : undefined}
    >
      <p style={{ margin: 0, ...body[15], fontFamily: font.body, color: color.text.secondary }}>
        List workspace projects. An expired access token shows the recovery flow.
      </p>

      <RequestPanel
        method="GET"
        url={url}
        onUrlChange={next => {
          setUrl(next);
          setUrlError(null);
        }}
        urlError={urlError ?? undefined}
        tokenLabel={
          sessionExpired
            ? `Access token · expired at ${expiresAt}`
            : `Access token · valid until ${expiresAt}`
        }
        tokenOptions={runnerAuthOptions(masked)}
        tokenValue={auth}
        onTokenChange={setAuth}
        tokenExpired={sessionExpired}
        running={running}
        onRun={handleRun}
      />

      {sessionExpired ? (
        <RecoveryResponse
          expiredAt={expiresAt}
          refreshValidUntil={session.refreshToken.expiresAt}
          refreshing={refreshing}
          error={refreshError}
          reference={refreshReference ?? undefined}
          onRefresh={handleRefresh}
          onSignIn={signOut}
        />
      ) : null}

      {failed ? (
        <Notice
          tone="error"
          heading={response?.errorCode === 'blocked_host' ? BLOCKED_HOST : GENERIC_ERROR}
          reference={response?.reference}
          action={
            <Button variant="secondary" onClick={handleRun}>
              Retry
            </Button>
          }
        />
      ) : null}

      {empty ? <Notice tone="neutral">Nothing to show yet</Notice> : null}

      <ResponseCard response={response} loading={running} />
    </WorkspaceLayout>
  );
}
