import type { ReactNode } from 'react';
import { body, color, font, radius, space } from '../styles/tokens';

/** AA/Chip — read-only provider name chip. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${space[6]}px ${space[10]}px`,
        border: `1px solid ${color.border.subtle}`,
        borderRadius: radius.pill,
        background: color.background.canvas,
        ...body[13],
        fontFamily: font.body,
        color: color.text.secondary,
      }}
    >
      {children}
    </span>
  );
}
