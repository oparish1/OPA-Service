import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../app/app-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { ProviderSelect } from '../components/ProviderSelect';
import { TextLink } from '../components/TextLink';
import { PublicLayout } from '../layouts/PublicLayout';
import { useAsyncData } from '../hooks/useAsyncData';
import { GENERIC_ERROR, PROVIDER_ERROR } from '../lib/copy';
import { changePassword, getSession } from '../api';
import { ENABLED_PROVIDERS } from '../mocks/data';
import { body, color, font, label, space } from '../styles/tokens';

const PROVIDER_OPTIONS = ENABLED_PROVIDERS.map(provider => ({
  value: provider.id,
  label: provider.name,
}));

/** Change password: managed-provider select with a mocked change request. */
export function ChangePassword() {
  const { navigate } = useApp();
  const { state: sessionState } = useAsyncData(getSession);
  const [provider, setProvider] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [failure, setFailure] = useState(false);
  const [destination, setDestination] = useState('—');
  const account = sessionState.status === 'ready' ? sessionState.data.account : null;

  async function submit(providerId: string) {
    setStatus('loading');
    setFailure(false);
    try {
      const result = await changePassword(providerId);
      setDestination(result.destination);
      setStatus('success');
    } catch {
      setStatus('idle');
      setFailure(true);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!provider) {
      setError(PROVIDER_ERROR);
      return;
    }
    setError(undefined);
    void submit(provider);
  }

  return (
    <PublicLayout
      brandLabel="IDENTITY / SECURITY"
      brandHeading={'Security,\non your terms.'}
      brandBody="Keep your identity secure with the provider your organisation already trusts."
      step="03"
      section="MANAGE"
      subtitle="One trusted identity. A clear path from sign-in to your next API call."
      title="Change password"
      description="Your password is managed by your identity provider. Open its security settings to update it securely."
      backLink={
        <TextLink onClick={() => navigate('sign-in')} leadingIcon={<ArrowLeft size={15} aria-hidden />}>
          Back to sign in
        </TextLink>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[20] }}>
        {failure ? (
          <Notice
            tone="error"
            heading={GENERIC_ERROR}
            action={
              <Button variant="secondary" onClick={() => void submit(provider)}>
                Retry
              </Button>
            }
          />
        ) : null}

        <ProviderSelect
          label="Identity provider"
          value={provider}
          onChange={value => {
            setProvider(value);
            if (error) setError(undefined);
          }}
          options={PROVIDER_OPTIONS}
          error={error}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <span style={{ ...label[12], fontFamily: font.body, color: color.text.secondary }}>ACCOUNT</span>
          <span style={{ ...body[15], fontFamily: font.body, color: color.text.primary }}>
            {account ? `${account.displayName} · ${account.email}` : '—'}
          </span>
          <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
            Available identity provider: Microsoft Entra ID
          </span>
        </div>

        <Notice tone="neutral" heading="Managed by your identity provider">
          You may need to sign in again and verify your current password or use multi-factor authentication.
          No password is entered here.
        </Notice>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space[16] }}>
          <Button type="submit" fullWidth state={status === 'loading' ? 'in-progress' : 'default'}>
            Change password
          </Button>
        </form>

        {status === 'success' ? (
          <Notice tone="success" heading="Provider destination opened">
            We opened the provider destination to change your password.
          </Notice>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <span style={{ ...label[12], fontFamily: font.body, color: color.text.secondary }}>
            PROVIDER DESTINATION
          </span>
          <span style={{ ...body[14], fontFamily: font.body, color: color.text.primary }}>{destination}</span>
          <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
            Changing your password may end existing sessions. Return to Agentic Advantage and sign in to
            obtain a new token pair.
          </span>
        </div>

        <TextLink onClick={() => navigate('forgot-password')}>Forgot your current password?</TextLink>
      </div>
    </PublicLayout>
  );
}
