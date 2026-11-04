import { LoaderCircle } from 'lucide-react';
import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { body, color, font, label, opacity, radius, size, space } from '../styles/tokens';

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
  /** Advisory policy reason; keeps the control focusable and explains why it is off. */
  disabledReason?: string;
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
  disabledReason,
}: ButtonProps) {
  const reasonId = useId();
  const inProgress = state === 'in-progress';
  const disabled = state === 'disabled' || inProgress;
  const blocked = disabledReason !== undefined;

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    height: size.buttonHeight,
    width: fullWidth ? '100%' : undefined,
    padding: `0 ${space[20]}px`,
    borderRadius: radius.button,
    cursor: disabled || blocked ? 'default' : 'pointer',
    opacity: state === 'disabled' ? opacity.disabled : 1,
    border: variant === 'primary' ? '1px solid transparent' : `1px solid ${color.border.control}`,
    background: variant === 'primary' ? color.action.primary : color.background.canvas,
    color: variant === 'primary' ? color.text.inverse : color.text.primary,
    ...label[15],
    fontFamily: font.body,
  };

  const control = (
    <button
      className="aa-focusable"
      type={type}
      disabled={disabled}
      aria-busy={inProgress || undefined}
      aria-disabled={blocked || undefined}
      aria-describedby={blocked ? reasonId : undefined}
      onClick={disabled || blocked ? undefined : onClick}
      style={style}
    >
      {inProgress ? <LoaderCircle className="aa-spin" size={16} aria-hidden /> : null}
      <span>{children}</span>
      {!inProgress && trailingIcon}
    </button>
  );

  if (!blocked) return control;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: space[4] }}>
      {control}
      <span id={reasonId} style={{ ...body[12], fontFamily: font.body, color: color.text.secondary }}>
        {disabledReason}
      </span>
    </span>
  );
}
