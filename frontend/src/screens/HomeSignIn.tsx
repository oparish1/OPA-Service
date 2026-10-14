import { useState } from 'react';
import { useApp } from '../app/app-context';
import { signIn } from '../api';
import { AuthenticationProvider } from '../components/AuthenticationProvider';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { ProviderIcon } from '../components/ProviderIcon';
import { TextLink } from '../components/TextLink';
import { PublicLayout } from '../layouts/PublicLayout';
import { GENERIC_ERROR } from '../lib/copy';
import { ENABLED_PROVIDERS } from '../mocks/data';
import type { ProviderId } from '../mocks/data';
import { space } from '../styles/tokens';

const ENTRA_PROVIDER = ENABLED_PROVIDERS[0];

/** Home — Sign in: the Microsoft Entra ID button and provider-managed password links. */
export function HomeSignIn() {
  const { navigate } = useApp();
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [callbackError] = useState(() => new URLSearchParams(window.location.search).get('error'));

  async function handleProvider(providerId: ProviderId) {
    setFailure(null);
    setProviderLoading(providerId);
    try {
      await signIn(providerId);
      navigate('overview');
    } catch (error) {
      setProviderLoading(null);
      setFailure(error instanceof Error ? error.message : GENERIC_ERROR);
    }
  }

  if (!ENTRA_PROVIDER) return null;

  return (
    <PublicLayout
      brandLabel="AGENTIC ADVANTAGE / DEVELOPER WORKSPACE"
      brandHeading={'Your identity.\nYour advantage.'}
      brandBody="Connect securely, understand your session and put your APIs to work."
      step="01"
      section="CONNECT"
      subtitle="One trusted identity. A clear path from sign-in to your next API call."
      title="Welcome to your workspace"
      description="Sign in with your organisation’s identity provider. Your first sign-in creates your account automatically."
      minHeight={1080}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[20] }}>
        {callbackError === 'signin' ? (
          <Notice tone="error" heading="We couldn’t sign you in. Try again." />
        ) : null}

        {failure ? (
          <Notice
            tone="error"
            heading={failure}
            action={
              <Button variant="secondary" onClick={() => void handleProvider(ENTRA_PROVIDER.id)}>
                Retry
              </Button>
            }
          />
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
          <AuthenticationProvider
            name={`Continue with ${ENTRA_PROVIDER.name}`}
            icon={<ProviderIcon name={ENTRA_PROVIDER.icon} size={20} />}
            state={providerLoading === ENTRA_PROVIDER.id ? 'in-progress' : 'default'}
            onClick={() => void handleProvider(ENTRA_PROVIDER.id)}
          />
        </div>

        <div style={{ display: 'flex', gap: space[20] }}>
          <TextLink onClick={() => navigate('forgot-password')}>Forgot password?</TextLink>
          <TextLink onClick={() => navigate('change-password')}>Change password</TextLink>
        </div>

        <Notice tone="neutral" heading="Your password stays with your provider">
          We never collect your password. Microsoft Entra ID manages sign-in, recovery and password changes.
        </Notice>
      </div>
    </PublicLayout>
  );
}
