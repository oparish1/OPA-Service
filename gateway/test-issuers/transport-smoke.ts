import { PROVIDER_IDS } from '../../shared/providers';
import { GATEWAY, ISSUERS } from './issuers';

/**
 * Live transport gate for the gateway Compose stack. A protected route answers
 * 200 only when APISIX reaches both the provider's discovery/JWKS and OPA, so
 * this fails on the transport mismatch the config gate alone cannot see. Run it
 * after `docker compose -f gateway/docker-compose.yml up -d`.
 */

async function mint(provider: (typeof PROVIDER_IDS)[number]): Promise<string> {
  const response = await fetch(`${ISSUERS[provider]}/mint`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const payload = (await response.json()) as { token: string };
  return payload.token;
}

let failures = 0;

for (const provider of PROVIDER_IDS) {
  const token = await mint(provider);
  const response = await fetch(`${GATEWAY}/${provider}/v1/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const decision = response.headers.get('x-auth-decision');
  if (response.status === 200 && decision === 'allow') {
    console.log(`  ok   ${provider} route reaches its issuer and OPA`);
  } else {
    failures += 1;
    console.error(`  FAIL ${provider} route: status ${response.status}, decision ${decision}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} transport check(s) failed`);
  process.exit(1);
}
console.log('\nGateway transport smoke passed');
