import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../app/app-context';
import { AuthenticationProvider } from '../components/AuthenticationProvider';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Notice } from '../components/Notice';
import { ProviderIcon } from '../components/ProviderIcon';
import { TextLink } from '../components/TextLink';
import { PublicLayout } from '../layouts/PublicLayout';
import { GENERIC_ERROR } from '../lib/copy';
import { isEmail } from '../lib/validation';
import { discoverSso, signIn } from '../mocks/api';
import { PROVIDERS } from '../mocks/data';
import type { ProviderId } from '../mocks/data';
import { color, font, label, space } from '../styles/tokens';

const INVALID_EMAIL = 'Please enter a valid work email address.';

/** Home — Sign in: provider buttons, organisation SSO, password links. */
export function HomeSignIn() {
  const { navigate } = useApp();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; providerId?: ProviderId } | null>(null);

  async function submitSso() {
    setSsoLoading(true);
    try {
      const discovery = await discoverSso(email);
      if (!discovery.found || !discovery.providerId) {
        setEmailError('No provider found for this domain');
        setSsoLoading(false);
        return;
      }
      await signIn(discovery.providerId);
      navigate('overview');
    } catch {
      setSsoLoading(false);
      setFailure({ message: GENERIC_ERROR });
    }
  }

  async function handleProvider(providerId: ProviderId) {
    setFailure(null);
    setProviderLoading(providerId);
    try {
      await signIn(providerId);
      navigate('overview');
    } catch (error) {
      setProviderLoading(null);
      setFailure({
        message: error instanceof Error ? error.message : GENERIC_ERROR,
        providerId,
      });
    }
  }

  function handleSso(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (!isEmail(email)) {
      setEmailError(INVALID_EMAIL);
      return;
    }
    setEmailError(undefined);
    void submitSso();
  }

  return (
    <PublicLayout
      brandLabel="AGENTIC ADVANTAGE / DEVELOPER WORKSPACE"
      brandHeading={'Your identity.\nYour advantage.'}
      brandBody="Connect securely, understand your session, and put your APIs to work."
      step="01"
      section="CONNECT"
      subtitle="One trusted identity. A clear path from sign-in to your next API call."
      title="Welcome to your workspace"
      description="Sign in with your organisation’s identity provider. Your first sign-in creates your account automatically."
      minHeight={1080}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[20] }}>
        {failure ? (
          <Notice
            tone="error"
            heading={failure.message}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  if (failure.providerId) void handleProvider(failure.providerId);
                  else void submitSso();
                }}
              >
                Retry
              </Button>
            }
          />
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
          {PROVIDERS.map(provider => (
            <AuthenticationProvider
              key={provider.id}
              name={`Continue with ${provider.name}`}
              icon={<ProviderIcon name={provider.icon} size={20} />}
              state={providerLoading === provider.id ? 'in-progress' : 'default'}
              onClick={() => handleProvider(provider.id)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: space[12] }}>
          <hr style={{ flex: 1, margin: 0, border: 'none', borderTop: `1px solid ${color.border.subtle}` }} />
          <span style={{ ...label[12], fontFamily: font.body, color: color.text.secondary }}>
            OR USE ORGANISATION SSO
          </span>
          <hr style={{ flex: 1, margin: 0, border: 'none', borderTop: `1px solid ${color.border.subtle}` }} />
        </div>

        <form onSubmit={handleSso} style={{ display: 'flex', flexDirection: 'column', gap: space[16] }}>
          <Input
            label="Work email"
            inputType="email"
            value={email}
            onChange={value => {
              setEmail(value);
              if (emailError) setEmailError(undefined);
            }}
            placeholder="orlando.parish@agentic-advantage.example"
            error={emailError}
          />
          <Button type="submit" fullWidth state={ssoLoading ? 'in-progress' : 'default'}>
            Continue with SSO
          </Button>
        </form>

        <div style={{ display: 'flex', gap: space[20] }}>
          <TextLink onClick={() => navigate('forgot-password')}>Forgot password?</TextLink>
          <TextLink onClick={() => navigate('change-password')}>Change password</TextLink>
        </div>

        <Notice tone="neutral" heading="Your password stays with your provider">
          We never collect your password. Your provider manages sign-in, recovery and password changes.
        </Notice>
      </div>
    </PublicLayout>
  );
}
