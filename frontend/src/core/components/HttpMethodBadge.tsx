import { code, color, font, radius, space, weight } from '../styles/tokens';

/** AA/HttpMethodBadge — surface.subtle fill, Code/14/SemiBold method label. */
export function HttpMethodBadge({ method = 'GET' }: { method?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${space[2]}px ${space[8]}px`,
        borderRadius: radius.button,
        background: color.surface.subtle,
        ...code[14],
        fontFamily: font.code,
        fontWeight: weight.semibold,
        color: color.text.primary,
      }}
    >
      {method}
    </span>
  );
}
