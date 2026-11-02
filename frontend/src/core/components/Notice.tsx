import { CircleAlert, CircleCheck, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { body, color, font, label, radius, space } from '../styles/tokens';

export type NoticeTone = 'neutral' | 'success' | 'error';

const TONE_ICON: Record<NoticeTone, LucideIcon> = {
  neutral: ShieldCheck,
  success: CircleCheck,
  error: CircleAlert,
};

interface NoticeProps {
  tone?: NoticeTone;
  heading?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  reference?: string;
}

/** Reusable info/alert box: surface.subtle fill and a tone-coloured left stripe. */
export function Notice({ tone = 'neutral', heading, children, icon, action, reference }: NoticeProps) {
  const Icon = TONE_ICON[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      data-tone={tone}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: space[14],
        padding: space[20],
        background: color.surface.subtle,
        borderLeft: `3px solid ${color.status[tone]}`,
        borderRadius: radius.card,
      }}
    >
      <span
        aria-hidden
        style={{ display: 'inline-flex', flexShrink: 0, color: color.status[tone] }}
      >
        {icon ?? <Icon size={18} />}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        {heading ? (
          <span style={{ ...label[14], fontFamily: font.body, color: color.text.primary }}>{heading}</span>
        ) : null}
        {children ? (
          <div style={{ ...body[14], fontFamily: font.body, color: color.text.secondary }}>{children}</div>
        ) : null}
        {action ? <div style={{ display: 'flex', gap: space[12] }}>{action}</div> : null}
        {reference ? (
          <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
            Reference: {reference}
          </span>
        ) : null}
      </div>
    </div>
  );
}
