import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../app/app-context';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Input } from '../components/Input';
import { Notice } from '../components/Notice';
import { RecoverySelect } from '../components/RecoverySelect';
import { TextLink } from '../components/TextLink';
import { useAsyncData } from '../hooks/useAsyncData';
import { PublicLayout } from '../layouts/PublicLayout';
import { GENERIC_ERROR, PROVIDER_ERROR } from '../lib/copy';
import { getProviders, resetPassword } from '../api';
import { body, color, font, label, space } from '../styles/tokens';

/** Forgot password: recovery select, provider chips, reset submission. */
export function ForgotPassword() {
  const { navigate } = useApp();
  const { state, reload } = useAsyncData(getProviders);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [failure, setFailure] = useState(false);
  const [destination, setDestination] = useState('—');

  const providers = state.status === 'ready' ? state.data : [];
  const options = providers.map(provider => ({ value: provider.id, label: provider.name }));
  const selected = providers.find(provider => provider.id === selectedProvider);
  const selectedId = selected?.id ?? null;
  const hasDestination = Boolean(selected?.forgotPasswordUrl);

  async function submit() {
    if (!selectedId) return;
    setStatus('loading');
    setFailure(false);
    try {
      const result = await resetPassword(selectedId);
      setDestination(result.destination);
      setStatus('success');
    } catch {
      setStatus('idle');
      setFailure(true);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) {
      setError(PROVIDER_ERROR);
      return;
    }
    setError(undefined);
    void submit();
  }

  return (
    <PublicLayout
      brandLabel="IDENTITY / RECOVERY"
      brandHeading={'A clear path\nback in.'}
      brandBody="Your identity provider helps you recover access. We’ll point you to the right place."
      step="02"
      section="RECOVER"
      subtitle="One trusted identity. A clear path from sign-in to your next API call."
      title="Forgot password?"
      description="Choose the provider you use to sign in. Password recovery happens on its secure website, not in Agentic Advantage."
      backLink={
        <TextLink onClick={() => navigate('sign-in')} leadingIcon={<ArrowLeft size={15} aria-hidden />}>
          Back to sign in
        </TextLink>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[20] }}>
        {state.status === 'error' ? (
          <Notice
            tone="error"
            heading={GENERIC_ERROR}
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
            heading={GENERIC_ERROR}
            action={
              <Button variant="secondary" onClick={() => void submit()}>
                Retry
              </Button>
            }
          />
        ) : null}

        <RecoverySelect
          label="Identity provider"
          value={selectedProvider}
          onChange={value => {
            setSelectedProvider(value);
            if (error) setError(undefined);
          }}
          options={options}
          error={error}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[8] }}>
          {options.map(provider => (
            <Chip key={provider.value}>{provider.label}</Chip>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space[16] }}>
          <Input
            label="Work email · for your reference"
            inputType="email"
            value={workEmail}
            onChange={setWorkEmail}
            placeholder="orlando.parish@agentic-advantage.example"
          />
          <Button
            type="submit"
            fullWidth
            state={
              status === 'loading'
                ? 'in-progress'
                : selectedId && !hasDestination
                  ? 'disabled'
                  : 'default'
            }
          >
            Reset password
          </Button>
        </form>

        {selectedId && !hasDestination ? (
          <Notice tone="neutral" heading="No recovery page is configured for this provider yet." />
        ) : null}

        {status === 'success' ? (
          <Notice tone="success" heading="Password reset request sent">
            Check your provider inbox to continue.
          </Notice>
        ) : null}
        <Notice tone="neutral" heading="You’re leaving this workspace">
          Your identity provider will verify your identity and guide you through its recovery options. Your
          organisation’s policy applies.
        </Notice>

        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <span style={{ ...label[12], fontFamily: font.body, color: color.text.secondary }}>
            PROVIDER DESTINATION
          </span>
          <span style={{ ...body[14], fontFamily: font.body, color: color.text.primary }}>{destination}</span>
          <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
            No recovery email is sent by this app. After recovery, return here and sign in again.
          </span>
        </div>

        <TextLink href="#">
          Can’t access your provider? Contact your IT team
        </TextLink>
      </div>
    </PublicLayout>
  );
}