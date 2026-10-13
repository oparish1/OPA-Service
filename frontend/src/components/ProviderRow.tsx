import type { ReactNode } from 'react';
import { body, color, font, label, size, space } from '../styles/tokens';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';
import { Button } from './Button';

interface ProviderRowProps {
  icon: ReactNode;
  name: string;
  subtitle: string;
  badgeTone: BadgeTone;
  badgeLabel: string;
  actionLabel: string;
  busy?: boolean;
  onAction: () => void;
}

/**
 * AA/ProviderRow — generic, props-driven identity-provider row. Microsoft,
 * Okta, Google and Organisation SSO are all instances of it.
 */
export function ProviderRow({
  icon,
  name,
  subtitle,
  badgeTone,
  badgeLabel,
  actionLabel,
  busy = false,
  onAction,
}: ProviderRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[16],
        padding: `${space[22]}px 0`,
        borderBottom: `1px solid ${color.border.subtle}`,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size.iconBox,
          height: size.iconBox,
          background: color.surface.subtle,
          color: color.text.primary,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: space[2] }}>
        <span style={{ ...label[16], fontFamily: font.body, color: color.text.primary }}>{name}</span>
        <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>{subtitle}</span>
      </div>
      <Badge tone={badgeTone}>{badgeLabel}</Badge>
      <Button variant="secondary" state={busy ? 'in-progress' : 'default'} onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
