import { body, color, font, radius, size } from '../styles/tokens';

interface AvatarProps {
  /** Initials rendered inside the circle, e.g. "OP". */
  initials: string;
  label?: string;
}

/** AA/Avatar — 60 × 60 circle, background.brand fill, Body/18 initials. */
export function Avatar({ initials, label }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={label ?? initials}
      style={{
        width: size.avatarSize,
        height: size.avatarSize,
        borderRadius: radius.circle,
        background: color.background.brand,
        ...body[18],
        fontFamily: font.body,
        color: color.text.primary,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {initials}
    </span>
  );
}
