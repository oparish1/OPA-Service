import { LoaderCircle } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { color, font, label, opacity, radius, size, space } from '../styles/tokens';

export type ButtonVariant = 'primary' | 'secondary';
export type ButtonState = 'default' | 'in-progress' | 'disabled';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  state?: ButtonState;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  trailingIcon?: ReactNode;
}

/** AA/Button — Style=Primary|Secondary, State=Default|In-progress|Disabled. */
export function Button({
  children,
  variant = 'primary',
  state = 'default',
  fullWidth = false,
  type = 'button',
  onClick,
  trailingIcon,
}: ButtonProps) {
  const inProgress = state === 'in-progress';
  const disabled = state === 'disabled' || inProgress;

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    height: size.buttonHeight,
    width: fullWidth ? '100%' : undefined,
    padding: `0 ${space[20]}px`,
    borderRadius: radius.button,
    cursor: disabled ? 'default' : 'pointer',
    opacity: state === 'disabled' ? opacity.disabled : 1,
    border: variant === 'primary' ? '1px solid transparent' : `1px solid ${color.border.control}`,
    background: variant === 'primary' ? color.action.primary : color.background.canvas,
    color: variant === 'primary' ? color.text.inverse : color.text.primary,
    ...label[15],
    fontFamily: font.body,
  };

  return (
    <button
      className="aa-focusable"
      type={type}
      disabled={disabled}
      aria-busy={inProgress || undefined}
      onClick={onClick}
      style={style}
    >
      {inProgress ? <LoaderCircle className="aa-spin" size={16} aria-hidden /> : null}
      <span>{children}</span>
      {!inProgress && trailingIcon}
    </button>
  );
}
