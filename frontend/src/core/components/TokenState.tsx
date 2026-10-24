import { Badge } from './Badge';

export type TokenStateValue = 'success' | 'expired';

/** AA/TokenState — token validity indicator: Success or Expired. */
export function TokenState({ state, label }: { state: TokenStateValue; label: string }) {
  return <Badge tone={state === 'success' ? 'success' : 'error'}>{label}</Badge>;
}
