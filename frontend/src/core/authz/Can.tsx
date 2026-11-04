import type { ReactNode } from 'react';
import type { CapabilityId } from './types';
import { useCan } from './useCan';

interface CanProps {
  capability: CapabilityId;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Renders its children only while the policy allows the capability. */
export function Can({ capability, children, fallback = null }: CanProps) {
  const decision = useCan(capability);
  return <>{decision.allowed ? children : fallback}</>;
}
