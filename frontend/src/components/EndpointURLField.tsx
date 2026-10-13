import { code, color, font, radius, size, space } from '../styles/tokens';

interface EndpointURLFieldProps {
  value: string;
}

/**
 * Local EndpointURLField — read-only endpoint display: 44 px, 1 px border,
 * IBM Plex Mono 14. Deliberately not an AA/Form/Input; it is never editable.
 */
export function EndpointURLField({ value }: EndpointURLFieldProps) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        height: size.navItemHeight,
        padding: `0 ${space[14]}px`,
        border: `1px solid ${color.border.subtle}`,
        borderRadius: radius.input,
        background: color.background.canvas,
        ...code[14],
        fontFamily: font.code,
        color: color.text.primary,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </span>
  );
}
