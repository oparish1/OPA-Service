import type { ProviderModule } from '../../core/provider';
import { entraEnabled, entraEnvShape, entraRequirements, parseEntra } from './config';
import type { EntraProviderConfig } from './config';
import { createEntraDefinition } from './definition';

export const entraModule: ProviderModule = {
  id: 'entra',
  envShape: entraEnvShape,
  enabled: entraEnabled,
  requirements: entraRequirements,
  parse: parseEntra,
  createDefinition: (config, providerConfig) =>
    createEntraDefinition(config, providerConfig as EntraProviderConfig),
};
