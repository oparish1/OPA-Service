import { useApp } from '../app/app-context';
import type { RunnerAuth } from '../types';
import { code, color, font, label, radius, space } from '../styles/tokens';
import { Button } from './Button';
import { EndpointURLField } from './EndpointURLField';
import { HttpMethodBadge } from './HttpMethodBadge';
import { TextLink } from './TextLink';
import { TokenSelect } from './TokenSelect';
import type { TokenOption } from './TokenSelect';

interface RequestPanelProps {
  method: string;
  url: string;
  onUrlChange: (value: string) => void;
  urlError?: string;
  tokenLabel: string;
  tokenOptions: readonly TokenOption<RunnerAuth>[];
  tokenValue: RunnerAuth;
  onTokenChange: (value: RunnerAuth) => void;
  tokenExpired?: boolean;
  running: boolean;
  onRun: () => void;
  /** Advisory policy reason that disables the run control. */
  runDisabledReason?: string;
}

/**
 * Local RequestPanel — shared by the Profile and Projects API screens:
 * HttpMethodBadge + editable URL + TokenSelect + Run request + View session.
 */
export function RequestPanel({
  method,
  url,
  onUrlChange,
  urlError,
  tokenLabel,
  tokenOptions,
  tokenValue,
  onTokenChange,
  tokenExpired = false,
  running,
  onRun,
  runDisabledReason,
}: RequestPanelProps) {
  const { navigate } = useApp();

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space[16],
        padding: space[24],
        background: color.background.canvas,
        border: `1px solid ${color.border.subtle}`,
        borderRadius: radius.card,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space[12] }}>
        <h2 style={{ margin: 0, ...label[16], fontFamily: font.body, color: color.text.primary }}>Request</h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: space[12] }}>
        <HttpMethodBadge method={method} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <EndpointURLField
            value={url}
            onChange={onUrlChange}
            onEnter={onRun}
            error={urlError}
          />
        </div>
        <Button state={running ? 'in-progress' : 'default'} onClick={onRun} disabledReason={runDisabledReason}>
          Run request
        </Button>
      </div>

      <TokenSelect
        label="Authorization"
        value={tokenValue}
        options={tokenOptions}
        onChange={onTokenChange}
        expired={tokenExpired}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[16] }}>
        <span
          style={{
            ...code[12],
            fontFamily: font.code,
            color: tokenExpired ? color.status.error : color.text.secondary,
          }}
        >
          {tokenLabel}
        </span>
        <TextLink onClick={() => navigate('overview')}>View session</TextLink>
      </div>
    </section>
  );
}
