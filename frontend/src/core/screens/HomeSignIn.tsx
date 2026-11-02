import { useState } from 'react';
import { useApp } from '../app/app-context';
import { getProviders, signIn } from '../api';
import { AuthenticationProvider } from '../components/AuthenticationProvider';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { ProviderIcon } from '../components/ProviderIcon';
import { TextLink } from '../components/TextLink';
import { useAsyncData } from '../hooks/useAsyncData';
import { PublicLayout } from '../layouts/PublicLayout';
import { GENERIC_ERROR } from '../lib/copy';
import { describeError, log } from '../lib/log';
import { space } from '../styles/tokens';

/** Home — Sign in: one button per provider the BFF reports as enabled. */
export function HomeSignIn() {
  const { navigate } = useApp();
  const { state, reload } = useAsyncData(getProviders);
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; reference: string } | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [callbackError] = useState(() => new URLSearchParams(window.location.search).get('error'));
  const [callbackReference] = useState(() =>
    callbackError === 'signin' ? log.error('sign-in', 'Provider redirect was rejected') : null
  );

  async function handleProvider(providerId: string) {
    setFailure(null);
    setLastProvider(providerId);
    setProviderLoading(providerId);
    try {
      await signIn(providerId);
      navigate('overview');
    } catch (error) {
      const reference = log.error('sign-in', 'Sign-in failed', {
        provider: providerId,
        error: describeError(error),
      });
      setProviderLoading(null);
      setFailure({ message: error instanceof Error ? error.message : GENERIC_ERROR, reference });
    }
  }

  const providers = state.status === 'ready' ? state.data : [];

  return (
    <PublicLayout
      brandLabel="AGENTIC ADVANTAGE / DEVELOPER WORKSPACE"
      brandHeading={'Your identity.\nYour advantage.'}
      brandBody="Connect securely, understand your session and put your APIs to work."
      step="01"
      section="CONNECT"
      subtitle="One trusted identity. A clear path from sign-in to your next API call."
      title="Welcome to your workspace"
      description="Sign in with your organisation’s identity provider."
      minHeight={1080}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[20] }}>
        {callbackError === 'signin' ? (
          <Notice
            tone="error"
            heading="We couldn’t sign you in. Try again."
            reference={callbackReference ?? undefined}
          />
        ) : null}

        {state.status === 'error' ? (
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
        ) : null}

        {failure ? (
          <Notice
            tone="error"
            heading={failure.message}
            reference={failure.reference}
            action={
              lastProvider ? (
                <Button variant="secondary" onClick={() => void handleProvider(lastProvider)}>
                  Retry
                </Button>
              ) : null
            }
          />
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
          {providers.map(provider => (
            <AuthenticationProvider
              key={provider.id}
              name={`Continue with ${provider.name}`}
              icon={<ProviderIcon id={provider.id} size={20} />}
              state={providerLoading === provider.id ? 'in-progress' : 'default'}
              onClick={() => void handleProvider(provider.id)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: space[20] }}>
          <TextLink onClick={() => navigate('forgot-password')}>Forgot password?</TextLink>
          <TextLink onClick={() => navigate('change-password')}>Change password</TextLink>
        </div>

        <Notice tone="neutral" heading="Your password stays with your provider">
          Your organisation’s identity provider manages sign-in, recovery and password changes.
        </Notice>
      </div>
    </PublicLayout>
  );
}