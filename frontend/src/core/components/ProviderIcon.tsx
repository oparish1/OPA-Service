import { Building2 } from 'lucide-react';
import { getProviderRegistry } from '../providers/active';

/** Renders the icon the active registry owns for the id, or a neutral fallback. */
export function ProviderIcon({ id, size = 18 }: { id: string; size?: number }) {
  const provider = getProviderRegistry().get(id);
  if (provider) return <>{provider.renderIcon(size)}</>;
  return <Building2 size={size} aria-hidden />;
}
