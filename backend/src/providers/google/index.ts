import type { ProviderId } from '../../../../shared/providers';
import type { ProviderModule } from '../../core/provider';
import { googleEnabled, googleEnvShape, googleRequirements, parseGoogle } from './config';
import type { GoogleProviderConfig } from './config';
import { createGoogleDefinition } from './definition';

export { googleIssuerIsExact } from './definition';

export const googleModule: ProviderModule = {
  id: 'google' satisfies ProviderId,
  envShape: googleEnvShape,
  enabled: googleEnabled,
  requirements: googleRequirements,
  parse: parseGoogle,
  createDefinition: (config, providerConfig) =>
    createGoogleDefinition(config, providerConfig as GoogleProviderConfig),
};
