import type { ReactNode } from 'react';
import type { CopyStatus } from '../hooks/useCopyFeedback';
import { body, color, code, font, label, radius, space } from '../styles/tokens';
import { Skeleton } from './Skeleton';
import { TokenValue } from './TokenValue';
import type { TokenValueState } from './TokenValue';

interface TokenCardProps {
  title: string;
  badge: ReactNode;
  description?: string;
  masked: string;
  value: string;
  state: TokenValueState;
  onToggleReveal: () => void;
  copyStatus: CopyStatus;
  onCopy: () => void;
  details: ReadonlyArray<{ label: string; value: string }>;
  loading?: boolean;
}

/** AA/TokenCard — State=Loading|Loaded; wraps AA/TokenValue and its detail rows. */
export function TokenCard({
  title,
  badge,
  description,
  masked,
  value,
  state,
  onToggleReveal,
  copyStatus,
  onCopy,
  details,
  loading = false,
}: TokenCardProps) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space[16],
        padding: space[24],
        background: color.background.canvas,
        border: `1px solid ${color.border.control}`,
        borderRadius: radius.card,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[12] }}>
        <h2 style={{ margin: 0, ...label[16], fontFamily: font.body, color: color.text.primary }}>{title}</h2>
        {loading ? null : badge}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
          <Skeleton height={88} />
          <Skeleton width="70%" />
        </div>
      ) : (
        <>
          {description ? (
            <p style={{ margin: 0, ...body[13], fontFamily: font.body, color: color.text.secondary }}>
              {description}
            </p>
          ) : null}

          <TokenValue
            masked={masked}
            value={value}
            state={state}
            onToggleReveal={onToggleReveal}
            copyStatus={copyStatus}
            onCopy={onCopy}
          />

          <dl style={{ display: 'flex', flexDirection: 'column', gap: space[8], margin: 0 }}>
            {details.map(detail => (
              <div key={detail.label} style={{ display: 'flex', justifyContent: 'space-between', gap: space[16] }}>
                <dt style={{ ...code[12], fontFamily: font.code, color: color.text.secondary }}>
                  {detail.label}
                </dt>
                <dd style={{ margin: 0, ...code[12], fontFamily: font.code, color: color.text.primary }}>
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
