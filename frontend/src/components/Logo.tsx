import { color, font, heading, label, radius, space } from '../styles/tokens';

/** AA/Brand/Logo/Purple — 152 × 64. */
export function Logo({ height = 64 }: { height?: number }) {
  const mark = Math.round(height * 0.56);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[12], height }}>
      <span
        aria-hidden
        style={{
          width: mark,
          height: mark,
          borderRadius: radius.circle,
          background: color.action.primary,
          color: color.text.inverse,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: font.heading,
          fontSize: Math.round(mark * 0.42),
          lineHeight: 1,
        }}
      >
        AA
      </span>
      <span
        style={{
          fontFamily: font.heading,
          fontSize: heading[24].fontSize,
          letterSpacing: heading[24].letterSpacing,
          lineHeight: heading[24].lineHeight,
          color: color.text.primary,
        }}
      >
        Agentic
        <br />
        <span style={{ ...label[14], fontFamily: font.heading }}>Advantage</span>
      </span>
    </div>
  );
}
