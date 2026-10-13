import { Check, CircleAlert, Copy, Eye, EyeOff } from 'lucide-react';
import type { CopyStatus } from '../hooks/useCopyFeedback';
import { code, color, font, label, space, tracking } from '../styles/tokens';
import { TextLink } from './TextLink';

export type TokenValueState = 'masked' | 'revealed' | 'expired';

interface TokenValueProps {
  masked: string;
  value: string;
  state: TokenValueState;
  onToggleReveal: () => void;
  copyStatus: CopyStatus;
  onCopy: () => void;
}

/** AA/TokenValue — State=Masked|Revealed|Expired with Reveal/Hide and Copy. */
export function TokenValue({
  masked,
  value,
  state,
  onToggleReveal,
  copyStatus,
  onCopy,
}: TokenValueProps) {
  const revealed = state === 'revealed';
  const expired = state === 'expired';
  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy';
  const copyIcon =
    copyStatus === 'copied' ? (
      <Check size={15} aria-hidden />
    ) : copyStatus === 'failed' ? (
      <CircleAlert size={15} aria-hidden />
    ) : (
      <Copy size={15} aria-hidden />
    );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[12], padding: space[16], background: color.surface.code }}>
      <span style={{ ...label[11], fontFamily: font.body, color: color.text.secondary, letterSpacing: tracking.eyebrow }}>
        {expired ? 'DEMO VALUE · EXPIRED' : 'DEMO VALUE · TRUNCATED'}
      </span>
      <code
        style={{
          ...code['14/22'],
          fontFamily: font.code,
          color: expired ? color.status.error : color.text.primary,
          wordBreak: 'break-all',
        }}
      >
        {revealed ? value : masked}
      </code>
      <div style={{ display: 'flex', gap: space[16] }}>
        {expired ? null : (
          <TextLink
            onClick={onToggleReveal}
            leadingIcon={revealed ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
          >
            {revealed ? 'Hide' : 'Reveal'}
          </TextLink>
        )}
        <TextLink onClick={onCopy} trailingIcon={copyIcon}>
          {copyLabel}
        </TextLink>
      </div>
    </div>
  );
}
