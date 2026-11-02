import { useEffect, useState } from 'react';
import { useApp } from '../app/app-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { TextLink } from '../components/TextLink';
import { TokenCard } from '../components/TokenCard';
import { TokenState } from '../components/TokenState';
import { useAsyncData } from '../hooks/useAsyncData';
import { GENERIC_ERROR } from '../lib/copy';
import { describeError, log } from '../lib/log';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { getSession, refreshToken, revealToken } from '../api';
import type { Session } from '../mocks/types';
import { body, code, color, font, label, radius, size, space } from '../styles/tokens';

/** Overview — session: summary, token cards, metadata, next step. */
export function Overview() {
  const { navigate, signOut } = useApp();
  const { state, reload } = useAsyncData(getSession);
  const [session, setSession] = useState<Session | null>(null);
  const [revealAccess, setRevealAccess] = useState(false);
  const [revealRefresh, setRevealRefresh] = useState(false);
  const [revealedAccess, setRevealedAccess] = useState('');
  const [revealedRefresh, setRevealedRefresh] = useState('');
  const [accessExpired, setAccessExpired] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [refreshReference, setRefreshReference] = useState<string | null>(null);
  const accessCopy = useCopyFeedback();
  const refreshCopy = useCopyFeedback();

  useEffect(() => {
    if (state.status === 'ready') setSession(state.data);
  }, [state]);

  async function toggleAccessReveal() {
    if (revealAccess) {
      setRevealAccess(false);
      setRevealedAccess('');
      setRevealError(null);
      return;
    }
    try {
      setRevealedAccess(await revealToken('access'));
      setRevealAccess(true);
      setRevealError(null);
    } catch (error) {
      const reference = log.error('overview', 'Access token reveal failed', {
        error: describeError(error),
      });
      setRevealedAccess('');
      setRevealError(reference);
    }
  }

  async function toggleRefreshReveal() {
    if (revealRefresh) {
      setRevealRefresh(false);
      setRevealedRefresh('');
      setRevealError(null);
      return;
    }
    try {
      setRevealedRefresh(await revealToken('refresh'));
      setRevealRefresh(true);
      setRevealError(null);
    } catch (error) {
      const reference = log.error('overview', 'Refresh token reveal failed', {
        error: describeError(error),
      });
      setRevealedRefresh('');
      setRevealError(reference);
    }
  }

  async function handleRefresh() {
    setRefreshState('loading');
    setRevealAccess(false);
    setRevealRefresh(false);
    setRevealedAccess('');
    setRevealedRefresh('');
    setRevealError(null);
    setRefreshReference(null);
    try {
      const token = await refreshToken();
      setSession(current => (current ? { ...current, accessToken: token } : current));
      setAccessExpired(false);
      setRefreshState('idle');
    } catch (error) {
      const reference = log.error('overview', 'Token refresh failed', {
        error: describeError(error),
      });
      setAccessExpired(true);
      setRefreshReference(reference);
      setRefreshState('error');
    }
  }

  if (state.status === 'loading') {
    return (
      <WorkspaceLayout active="overview" breadcrumb="WORKSPACE / OVERVIEW" title="Welcome.">
        <div style={{ display: 'flex', gap: space[24], alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: size.tokenCardMinWidth }}>
            <TokenCard
              title="Access token"
              badge={null}
              masked=""
              value=""
              state="masked"
              onToggleReveal={() => undefined}
              copyStatus="idle"
              onCopy={() => undefined}
              details={[]}
              loading
            />
          </div>
          <div style={{ flex: 1, minWidth: size.tokenCardMinWidth }}>
            <TokenCard
              title="Refresh token"
              badge={null}
              masked=""
              value=""
              state="masked"
              onToggleReveal={() => undefined}
              copyStatus="idle"
              onCopy={() => undefined}
              details={[]}
              loading
            />
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  if (state.status === 'error') {
    return (
      <WorkspaceLayout active="overview" breadcrumb="WORKSPACE / OVERVIEW" title="Welcome.">
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

  const data = session ?? state.data;
  if (!data) return null;

  const canRefresh = data.renewable ?? data.refreshToken.masked !== '';
  const refreshControl = canRefresh ? (
    <Button state={refreshState === 'loading' ? 'in-progress' : 'default'} onClick={handleRefresh}>
      Refresh session
    </Button>
  ) : (
    <Button state="disabled">Refresh not available for this session</Button>
  );

  return (
    <WorkspaceLayout
      active="overview"
      breadcrumb="WORKSPACE / OVERVIEW"
      title="Welcome."
      actions={refreshControl}
    >
      <p style={{ margin: 0, ...body[15], fontFamily: font.body, color: color.text.secondary }}>
        Your identity is connected. Inspect your session or try a downstream API.
      </p>

      {refreshState === 'error' ? (
        <Notice
          tone="error"
          heading={GENERIC_ERROR}
          reference={refreshReference ?? undefined}
          action={
            <>
              <Button variant="secondary" onClick={handleRefresh}>
                Retry
              </Button>
              <TextLink onClick={signOut}>Sign in again</TextLink>
            </>
          }
        />
      ) : null}

      {!canRefresh ? (
        <Notice
          tone="neutral"
          heading="This session has no refresh token."
          action={<TextLink onClick={signOut}>Sign in again</TextLink>}
        />
      ) : null}

      {revealError ? (
        <Notice tone="error" heading={GENERIC_ERROR} reference={revealError} />
      ) : null}

      <Notice tone="neutral" heading={`Signed in with ${data.provider}`} />

      <div style={{ display: 'flex', gap: space[24], alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: size.tokenCardMinWidth }}>
          <TokenCard
            title="Access token"
            badge={<TokenState state={accessExpired ? 'expired' : 'success'} label={accessExpired ? 'Expired' : 'Valid · 18 min left'} />}
            description="Bearer token used to authorise downstream API requests."
            masked={data.accessToken.masked}
            value={revealedAccess}
            state={accessExpired ? 'expired' : revealAccess ? 'revealed' : 'masked'}
            onToggleReveal={() => void toggleAccessReveal()}
            copyStatus={accessCopy.status}
            onCopy={() => accessCopy.copy(revealedAccess)}
            details={[
              { label: 'EXPIRES AT', value: data.accessToken.expiresAt },
              { label: 'SCOPES', value: data.accessToken.scopes || '—' },
            ]}
          />
        </div>
        <div style={{ flex: 1, minWidth: size.tokenCardMinWidth }}>
          <TokenCard
            title="Refresh token"
            badge={<TokenState state="success" label={canRefresh ? 'Available' : 'Not issued'} />}
            description="Renews your access token. Never sent to an API."
            masked={data.refreshToken.masked}
            value={revealedRefresh}
            state={revealRefresh ? 'revealed' : 'masked'}
            onToggleReveal={() => void toggleRefreshReveal()}
            copyStatus={refreshCopy.status}
            onCopy={() => refreshCopy.copy(revealedRefresh)}
            details={[
              { label: 'EXPIRES AT', value: data.refreshToken.expiresAt },
              { label: 'GRANT', value: data.refreshToken.grant },
            ]}
          />
        </div>
      </div>

      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: space[12],
          padding: space[24],
          border: `1px solid ${color.border.subtle}`,
          borderRadius: radius.card,
        }}
      >
        <h2 style={{ margin: 0, ...label[14], fontFamily: font.body, color: color.text.primary }}>
          Session metadata
        </h2>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: space[8], margin: 0 }}>
          {[
            { label: 'ISSUER', value: data.issuer },
            { label: 'ISSUED AT', value: data.issuedAt },
            { label: 'SESSION SNAPSHOT', value: data.snapshot },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: space[16] }}>
              <dt style={{ ...code[12], fontFamily: font.code, color: color.text.secondary }}>{row.label}</dt>
              <dd style={{ margin: 0, ...code[12], fontFamily: font.code, color: color.text.primary }}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[24],
          padding: space[24],
          background: color.background.brand,
          borderRadius: radius.card,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <h2
            style={{
              margin: 0,
              ...label[15],
              fontFamily: font.body,
              color: color.text.primary,
            }}
          >
            From identity to insight.
          </h2>
          <p style={{ margin: 0, ...body[14], fontFamily: font.body, color: color.text.secondary }}>
            Use your access token to explore a sample profile response.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('profile-api')}>
          Open Profile API
        </Button>
      </section>
    </WorkspaceLayout>
  );
}
