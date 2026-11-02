import type { ReactNode } from 'react';
import { color, space } from '../styles/tokens';

/** Centres one fatal notice on an otherwise empty page. */
export function FatalNotice({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: space[24],
        background: color.background.canvas,
      }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>{children}</div>
    </div>
  );
}
