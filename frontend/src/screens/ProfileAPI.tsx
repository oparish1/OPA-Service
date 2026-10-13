import { useState } from 'react';
import { useApp } from '../app/app-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RecoveryResponse } from '../components/RecoveryResponse';
import { RequestPanel } from '../components/RequestPanel';
import { ResponseCard } from '../components/ResponseCard';
import { SkeletonBlock } from '../components/Skeleton';
import { TextLink } from '../components/TextLink';
import { useAsyncData } from '../hooks/useAsyncData';
import { GENERIC_ERROR } from '../lib/copy';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { getSession, refreshToken, runRequest } from '../mocks/api';
import { PROFILE_ENDPOINT } from '../mocks/data';
import type { ApiResponse } from '../mocks/types';
import { body, color, font } from '../styles/tokens';

/** Profile API — idle shell, successful response, errors, and 401 recovery. */
export function ProfileAPI() {
  const { navigate, signOut } = useApp();
  const { state, reload } = useAsyncData(getSession);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [masked, setMasked] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

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
  const activeToken = token ?? session.accessToken.value;
  const activeMasked = masked || session.accessToken.masked;
  const activeExpiresAt = expiresAt ?? session.accessToken.expiresAt;
  const expired = response?.status === 401;
  const failed =
    response !== null && response.status !== 401 && (response.status >= 400 || response.status === 0);

  async function handleRun() {
    setRunning(true);
    try {
      const result = await runRequest(activeToken, PROFILE_ENDPOINT);
      setResponse(result);
    } finally {
      setRunning(false);
    }
  }

  async function handleRefresh() {
    setRefreshError(null);
    setRefreshing(true);
    try {
      const newToken = await refreshToken();
      setToken(newToken.value);
      setMasked(newToken.masked);
      setExpiresAt(newToken.expiresAt);
      const result = await runRequest(newToken.value, PROFILE_ENDPOINT);
      setResponse(result);
    } catch {
      setRefreshError('Refresh token expired. Sign in again.');
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
        endpoint={PROFILE_ENDPOINT}
        tokenLabel={`Access token · valid until ${activeExpiresAt}`}
        tokenOptions={[{ value: activeToken, label: `Bearer · ${activeMasked}` }]}
        tokenValue={activeToken}
        onTokenChange={setToken}
        running={running}
        onRun={handleRun}
      />

      {expired ? (
        <RecoveryResponse
          expiredAt={activeExpiresAt}
          refreshValidUntil={session.refreshToken.expiresAt}
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

      <ResponseCard response={response} />

      {response?.status === 200 ? (
        <Notice tone="neutral" heading="Request authorised">
          Request authorised with profile.read. Your refresh token was not sent to this endpoint.
        </Notice>
      ) : null}
      <TextLink onClick={() => navigate('projects-api')}>Try Projects API</TextLink>

      <hr style={{ margin: 0, border: 'none', borderTop: `1px solid ${color.border.subtle}` }} />
      <span style={{ ...body[12], fontFamily: font.body, color: color.text.secondary }}>
        Demo response · No live request was made. Tokens, identity details and endpoints are illustrative.
      </span>
    </WorkspaceLayout>
  );
}
