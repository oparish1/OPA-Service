import logoUrl from '../assets/logo.svg';

/** AA/Brand/Logo/Purple. Rendered from the supplied logo image. */
export function Logo({ height = 84 }: { height?: number }) {
  return (
    <img
      src={logoUrl}
      alt="Agentic Advantage"
      height={height}
      style={{ display: 'block', height, width: 'auto' }}
    />
  );
}