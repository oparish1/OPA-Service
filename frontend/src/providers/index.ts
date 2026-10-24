import type { FrontendProviderModule } from '../core/providers/types';
import { entraModule } from './entra';
import { googleModule } from './google';
import { oktaModule } from './okta';

/** The composition point: the only file outside `shared/` that names every provider. */
export const PROVIDER_MODULES: readonly FrontendProviderModule[] = [
  entraModule,
  oktaModule,
  googleModule,
];
