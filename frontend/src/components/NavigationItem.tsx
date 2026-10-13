import type { ReactNode } from 'react';
import { body, color, font, label, size, space } from '../styles/tokens';

interface NavigationItemProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
}

/** AA/Navigation/Item — 44 px row, Selected shows purple 3 px left border. */
export function NavigationItem({ label: text, selected = false, onClick, icon }: NavigationItemProps) {
  return (
    <button
      className="aa-focusable"
      type="button"
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[10],
        width: '100%',
        height: size.navItemHeight,
        padding: `0 ${space[16]}px`,
        border: 'none',
        borderLeft: `3px solid ${selected ? color.action.primary : 'transparent'}`,
        background: selected ? color.surface.subtle : 'transparent',
        color: selected ? color.text.link : color.text.primary,
        ...(selected ? label[14] : body[14]),
        fontFamily: font.body,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}
