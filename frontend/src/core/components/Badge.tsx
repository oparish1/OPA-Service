import type { ReactNode } from 'react';
import { color, font, label, radius, space } from '../styles/tokens';

export type BadgeTone = 'neutral' | 'success' | 'error';

const TONE_BORDER: Record<BadgeTone, string> = {
  neutral: color.border.subtle,
  success: color.border.success,
  error: color.border.error,
};

/** AA/Feedback/Badge — Tone=Neutral|Success|Error. */
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${space[2]}px ${space[10]}px`,
        borderRadius: radius.pill,
        border: `1px solid ${TONE_BORDER[tone]}`,
        color: color.status[tone],
        ...label[12],
        fontFamily: font.body,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
