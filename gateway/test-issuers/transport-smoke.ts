import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROVIDER_IDS } from '../../shared/providers';
import { GATEWAY, ISSUERS } from './issuers';

/**
 * Live transport gate for the gateway Compose stack. A protected route answers
 * 200 only when APISIX reaches both the provider's discovery/JWKS and OPA, so
 * this fails on the transport mismatch the config gate alone cannot see. It
 * also proves each capabilities route returns the persona snapshot entry the
 * browser now consumes. Run it after
 * `docker compose -f gateway/docker-compose.yml up -d`.
 */

interface Decision {
  allowed: boolean;
  reason: string;
}

const snapshot = (
  JSON.parse(
    readFileSync(
      join(import.meta.dir, '..', '..', 'authz-service', 'fixtures', 'matrix.snapshot.json'),
      'utf8'
    )
  ) as { snapshot: Record<string, { allowed: string[]; denied: Record<string, string> }> }
).snapshot;

/** The allowed/denied shape `matrix.snapshot.json` stores, so the two are comparable. */
function normalized(decisions: Record<string, Decision>): { allowed: string[]; denied: Record<string, string> } {
  const allowed: string[] = [];
  const denied: Record<string, string> = {};
  for (const capability of Object.keys(decisions).sort()) {
    if (decisions[capability].allowed) allowed.push(capability);
    else denied[capability] = decisions[capability].reason;
  }
  return { allowed, denied };
}

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

  const capabilitiesResponse = await fetch(`${GATEWAY}/${provider}/authz/capabilities`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (capabilitiesResponse.status !== 200) {
    failures += 1;
    console.error(`  FAIL ${provider} capabilities route: status ${capabilitiesResponse.status}`);
    continue;
  }
  const actual = normalized((await capabilitiesResponse.json()) as Record<string, Decision>);
  const expected = snapshot[`${provider}-user`];
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ok   ${provider} capabilities match the ${provider}-user snapshot`);
  } else {
    failures += 1;
    console.error(
      `  FAIL ${provider} capabilities differ from the ${provider}-user snapshot: ${JSON.stringify({ expected, actual })}`
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} transport check(s) failed`);
  process.exit(1);
}
console.log('\nGateway transport smoke passed');
