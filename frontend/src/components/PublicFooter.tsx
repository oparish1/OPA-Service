import { body, color, font, size, space } from '../styles/tokens';
import { TextLink } from './TextLink';

/** Reusable public-page footer, 74 px: copyright, disclaimer, Privacy / Terms. */
export function PublicFooter() {
  return (
    <footer
      style={{
        height: size.publicFooterHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${space[40]}px`,
        borderTop: `1px solid ${color.border.subtle}`,
        ...body[12],
        fontFamily: font.body,
        color: color.text.secondary,
      }}
    >
      <span>© 2026 Agentic Advantage</span>
      <span>Design demonstration · No live authentication or API connections</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: space[8] }}>
        <TextLink href="#">Privacy</TextLink>
        <span aria-hidden>/</span>
        <TextLink href="#">Terms</TextLink>
      </span>
    </footer>
  );
}
