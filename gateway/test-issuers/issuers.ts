import { PROVIDER_IDS, type ProviderId } from '../../shared/providers';

/**
 * Where the Docker integration scripts find the gateway and the local test
 * issuers. The provider set comes from the shared wire contract, so a provider
 * the stack gates cannot be missing from the scripts that exercise it.
 */

const FIRST_ISSUER_PORT = 8090;

export const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:9080';

export const ISSUERS = Object.fromEntries(
  PROVIDER_IDS.map((id, index) => [
    id,
    process.env[`${id.toUpperCase()}_ISSUER_URL`] ?? `http://localhost:${FIRST_ISSUER_PORT + index}`,
  ])
) as Record<ProviderId, string>;
