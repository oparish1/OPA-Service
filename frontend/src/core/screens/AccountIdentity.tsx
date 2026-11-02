import { useApp } from '../app/app-context';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { ProviderIcon } from '../components/ProviderIcon';
import { ProviderRow } from '../components/ProviderRow';
import { Skeleton } from '../components/Skeleton';
import { TextLink } from '../components/TextLink';
import { useAsyncData } from '../hooks/useAsyncData';
import { GENERIC_ERROR } from '../lib/copy';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { getIdentities, getSession } from '../api';
import type { Identity } from '../mocks/types';
import { body, color, font, heading, label, radius, size, space, weight } from '../styles/tokens';

function initials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function rowFor(identity: Identity) {
  const linked = identity.status !== 'not-connected';
  return {
    icon: <ProviderIcon id={identity.id} size={18} />,
    name: identity.name,
    subtitle: identity.subtitle,
    badgeTone: linked ? ('success' as const) : ('neutral' as const),
    badgeLabel: identity.status === 'primary' ? 'Primary' : linked ? 'Connected' : 'Not connected',
    // No configured destination means no action; the deferred Connect flow is out of scope.
    actionLabel: linked && identity.manageUrl ? 'Manage' : undefined,
  };
}

/** Account & identity providers: provisioned account, identities, security. */
export function AccountIdentity() {
  const { navigate } = useApp();
  const { state, reload } = useAsyncData(async () => {
    const [session, identities] = await Promise.all([getSession(), getIdentities()]);
    return { session, identities };
  });

  function handleAction(identity: Identity) {
    if (!identity.manageUrl) return;
    window.open(identity.manageUrl, '_blank', 'noopener,noreferrer');
  }

  if (state.status === 'loading') {
    return (
      <WorkspaceLayout
        active="account"
        breadcrumb="WORKSPACE / ACCOUNT & IDENTITY"
        title="One account. Your identities."
      >
        <div style={{ display: 'flex', gap: space[24], alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: size.accountCardWidth, display: 'flex', flexDirection: 'column', gap: space[12] }}>
            <Skeleton width={size.avatarSize} height={size.avatarSize} />
            <Skeleton width="70%" />
            <Skeleton width="55%" />
          </div>
          <div style={{ flex: 1, minWidth: size.identityListMinWidth, display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3].map(index => (
              <Skeleton key={index} height={56} />
            ))}
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  if (state.status === 'error') {
    return (
      <WorkspaceLayout
        active="account"
        breadcrumb="WORKSPACE / ACCOUNT & IDENTITY"
        title="One account. Your identities."
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

  const { session, identities } = state.data;
  const account = session.account;

  return (
    <WorkspaceLayout
      active="account"
      breadcrumb="WORKSPACE / ACCOUNT & IDENTITY"
      title="One account. Your identities."
    >
      <p style={{ margin: 0, ...body[15], fontFamily: font.body, color: color.text.secondary }}>
        Your workspace account is provisioned automatically and linked to your trusted providers.
      </p>

      <div style={{ display: 'flex', gap: space[24], alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {account ? (
        <section
          style={{
            width: size.accountCardWidth,
            display: 'flex',
            flexDirection: 'column',
            gap: space[12],
            padding: space[24],
            background: color.surface.subtle,
            borderRadius: radius.card,
          }}
        >
          <Avatar initials={initials(account.displayName)} label={account.displayName} />
          <span
            style={{
              ...heading[28],
              fontFamily: font.heading,
              fontWeight: weight.medium,
              color: color.text.primary,
            }}
          >
            {account.displayName}
          </span>
          <span style={{ ...body[15], fontFamily: font.body, color: color.text.secondary }}>
            {account.email}
          </span>
          <Badge tone="success">Account active</Badge>
          <hr style={{ margin: 0, border: 'none', borderTop: `1px solid ${color.border.subtle}` }} />
          <dl style={{ display: 'flex', flexDirection: 'column', gap: space[8], margin: 0 }}>
            {[
              { label: 'ORGANISATION', value: account.organisation },
              { label: 'WORKSPACE ROLE', value: account.role },
              { label: 'ACCOUNT ID', value: account.accountId },
              { label: 'CREATED ON FIRST SIGN-IN', value: account.createdAt },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: space[12] }}>
                <dt style={{ ...body[12], fontFamily: font.body, color: color.text.secondary }}>{row.label}</dt>
                <dd style={{ margin: 0, ...body[14], fontFamily: font.body, color: color.text.primary }}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <span style={{ ...body[12], fontFamily: font.body, color: color.text.secondary }}>
            Profile details come from your identity provider. Ask your IT team to update them.
          </span>
        </section>
        ) : (
          <Notice tone="error" heading={GENERIC_ERROR} />
        )}

        <section style={{ flex: 1, minWidth: size.identityListMinWidth }}>
          <h2 style={{ margin: `0 0 ${space[8]}px`, ...label[16], fontFamily: font.body, color: color.text.primary }}>
            Identity providers
          </h2>
          <p style={{ margin: `0 0 ${space[16]}px`, ...body[14], fontFamily: font.body, color: color.text.secondary }}>
            Your organisation identity is linked to this demo account. The primary provider issued your
            current session.
          </p>
          {identities.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space[16],
                padding: space[24],
                border: `1px solid ${color.border.subtle}`,
                borderRadius: radius.card,
              }}
            >
              <span style={{ ...body[15], fontFamily: font.body, color: color.text.secondary }}>
                No identity providers connected
              </span>
            </div>
          ) : (
            identities.map(identity => (
              <ProviderRow
                key={identity.id}
                {...rowFor(identity)}
                onAction={() => handleAction(identity)}
              />
            ))
          )}
        </section>
      </div>

      <Notice tone="neutral" heading="Connect identities safely">
        Linking another provider requires verification of both identities. A matching email alone does not
        merge accounts.
      </Notice>

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
        <h2 style={{ margin: 0, ...label[16], fontFamily: font.body, color: color.text.primary }}>
          Password &amp; security
        </h2>
        <p style={{ margin: 0, ...body[14], fontFamily: font.body, color: color.text.secondary }}>
          Passwords and multi-factor authentication are managed by your selected identity provider.
        </p>
        <div style={{ display: 'flex', gap: space[20] }}>
          <TextLink onClick={() => navigate('change-password')}>Change password</TextLink>
          <TextLink onClick={() => navigate('forgot-password')}>Forgot password?</TextLink>
        </div>
      </section>
    </WorkspaceLayout>
  );
}
