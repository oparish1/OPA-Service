import type { ProviderModule } from '../../core/provider';
import { oktaEnabled, oktaEnvShape, oktaRequirements, parseOkta } from './config';
import type { OktaProviderConfig } from './config';
import { createOktaDefinition } from './definition';

export const oktaModule: ProviderModule = {
  id: 'okta',
  envShape: oktaEnvShape,
  enabled: oktaEnabled,
  requirements: oktaRequirements,
  parse: parseOkta,
  createDefinition: (config, providerConfig) =>
    createOktaDefinition(config, providerConfig as OktaProviderConfig),
};
