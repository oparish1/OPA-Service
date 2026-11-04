import { useRef, useState } from 'react';
import { useApp } from '../app/app-context';
import { useCan } from '../authz/useCan';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RecoveryResponse } from '../components/RecoveryResponse';
import { RequestPanel } from '../components/RequestPanel';
import { ResponseCard } from '../components/ResponseCard';
import { SkeletonBlock } from '../components/Skeleton';
import { TextLink } from '../components/TextLink';
import { useAsyncData } from '../hooks/useAsyncData';
import { BLOCKED_HOST, GENERIC_ERROR, permissionReason } from '../lib/copy';
import { describeError, log } from '../lib/log';
import { appUrl, PROFILE_PATH, runnerAuthOptions, validateRunnerUrl } from '../lib/runner-url';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { getSession, refreshToken, runRequest } from '../api';
import type { ApiResponse, RunnerAuth } from '../types';
import { body, color, font } from '../styles/tokens';

/** Profile API — idle shell, successful response, errors and 401 recovery. */
export function ProfileAPI() {
  const { navigate, signOut } = useApp();
  const { state, reload } = useAsyncData(getSession);
  const [url, setUrl] = useState(() => appUrl(PROFILE_PATH));
  const [auth, setAuth] = useState<RunnerAuth>('session');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailure, setRefreshFailure] = useState<{ message: string; reference: string } | null>(
    null
  );
  const [accessMeta, setAccessMeta] = useState<{ masked: string; expiresAt: string } | null>(null);
  const [lastRun, setLastRun] = useState<{ url: string; auth: RunnerAuth } | null>(null);
  const runSeq = useRef(0);
  const readDecision = useCan('action.api.send.read');

  if (state.status === 'loading') {
    return (
      <WorkspaceLayout
        active="profile-api"
        breadcrumb="DOWNSTREAM APIs / PROFILE"
        title="Get to know your identity."
      >
        <SkeletonBlock lines={4} />
      </WorkspaceLayout>
    );
  }

  if (state.status === 'error') {
    return (
      <WorkspaceLayout
        active="profile-api"
        breadcrumb="DOWNSTREAM APIs / PROFILE"
        title="Get to know your identity."
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
    setRefreshFailure(null);
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
      const reference = log.error('profile-api', 'Token refresh failed', {
        error: describeError(error),
      });
      setRefreshFailure({ message: 'Refresh token expired. Sign in again.', reference });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <WorkspaceLayout
      active="profile-api"
      breadcrumb="DOWNSTREAM APIs / PROFILE"
      title="Get to know your identity."
    >
      <p style={{ margin: 0, ...body[15], fontFamily: font.body, color: color.text.secondary }}>
        Retrieve the signed-in user’s profile using the access token from your current session.
      </p>

      <RequestPanel
        method="GET"
        url={url}
        onUrlChange={next => {
          setUrl(next);
          setUrlError(null);
        }}
        urlError={urlError ?? undefined}
        tokenLabel={`Access token · valid until ${expiresAt}`}
        tokenOptions={runnerAuthOptions(masked)}
        tokenValue={auth}
        onTokenChange={setAuth}
        running={running}
        onRun={handleRun}
        runDisabledReason={readDecision.allowed ? undefined : permissionReason(readDecision.reason)}
      />

      {sessionExpired ? (
        <RecoveryResponse
          expiredAt={expiresAt}
          refreshValidUntil={session.refreshToken.expiresAt}
          refreshing={refreshing}
          failure={refreshFailure}
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

      <ResponseCard response={response} loading={running} />

      {response?.status === 200 ? (
        <Notice tone="neutral" heading="Request authorised">
          Request authorised with workspace:read. Your refresh token was not sent to this endpoint.
        </Notice>
      ) : null}
      <TextLink onClick={() => navigate('projects-api')}>Try Projects API</TextLink>
    </WorkspaceLayout>
  );
}
