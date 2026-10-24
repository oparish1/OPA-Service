import type { CSSProperties, ReactNode } from 'react';
import { color, font, label, space } from '../styles/tokens';

interface TextLinkProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  trailingIcon?: ReactNode;
  leadingIcon?: ReactNode;
}

/** AA/TextLink — purple Label/14/SemiBold with optional leading/trailing icon. */
export function TextLink({
  children,
  onClick,
  href,
  trailingIcon,
  leadingIcon,
}: TextLinkProps) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space[4],
    padding: 0,
    background: 'transparent',
    border: 'none',
    color: color.text.link,
    ...label[14],
    fontFamily: font.body,
    textDecoration: 'none',
    cursor: 'pointer',
  };

  const content = (
    <>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </>
  );

  if (href !== undefined) {
    return (
      <a className="aa-focusable" href={href} onClick={onClick} style={style}>
        {content}
      </a>
    );
  }

  return (
    <button className="aa-focusable" type="button" onClick={onClick} style={style}>
      {content}
    </button>
  );
}
