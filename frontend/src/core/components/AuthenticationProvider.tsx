import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { color, font, label, opacity, radius, size, space } from '../styles/tokens';

export type ProviderState = 'default' | 'in-progress' | 'disabled';

interface AuthenticationProviderProps {
  name: string;
  icon: ReactNode;
  state?: ProviderState;
  onClick?: () => void;
}

/** AA/Authentication/Provider — 56 px row, provider icon + label + open-in-new icon. */
export function AuthenticationProvider({
  name,
  icon,
  state = 'default',
  onClick,
}: AuthenticationProviderProps) {
  const disabled = state !== 'default';
  return (
    <button
      className="aa-focusable"
      type="button"
      disabled={disabled}
      aria-busy={state === 'in-progress' || undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[12],
        width: '100%',
        height: size.providerRowHeight,
        padding: `0 ${space[16]}px`,
        background: color.background.canvas,
        border: `1px solid ${color.border.control}`,
        borderRadius: radius.button,
        cursor: disabled ? 'default' : 'pointer',
        opacity: state === 'disabled' ? opacity.disabled : 1,
      }}
    >
      <span style={{ display: 'inline-flex', color: color.text.primary }}>{icon}</span>
      <span style={{ flex: 1, textAlign: 'left', ...label[16], fontFamily: font.body, color: color.text.primary }}>
        {name}
      </span>
      {state === 'in-progress' ? (
        <LoaderCircle className="aa-spin" size={16} aria-hidden />
      ) : (
        <ArrowUpRight size={16} aria-hidden color={color.text.secondary} />
      )}
    </button>
  );
}
