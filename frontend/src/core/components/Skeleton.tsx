import { color, radius, space } from '../styles/tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number;
}

/** Token-only loading placeholder used by the initial-load skeletons. */
export function Skeleton({ width = '100%', height = 16 }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className="aa-skeleton"
      style={{ width, height, borderRadius: radius.button, background: color.surface.code }}
    />
  );
}

/** A short stack of skeleton lines for a loading region. */
export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
      {Array.from({ length: lines }, (_value, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
