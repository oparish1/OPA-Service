import type { ReactNode } from 'react';
import type { ProviderLinks } from '../../../../shared/providers';

/** One provider's self-contained frontend slice: name, domains, links and icon. */
export interface FrontendProviderModule {
  readonly id: string;
  readonly name: string;
  readonly ssoDomain: string;
  readonly links: ProviderLinks;
  renderIcon(size: number): ReactNode;
}

export interface ProviderRegistry {
  readonly all: readonly FrontendProviderModule[];
  get(id: string): FrontendProviderModule | undefined;
}
