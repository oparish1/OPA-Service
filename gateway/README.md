# Gateway

The Apache APISIX gateway is the only authority for the browser app. It
validates every token, authorizes each provider's claims and serves the `/v1`
demo bodies from the golden fixtures. It holds **no identity-provider secret**
(SD-11): the route file references environment variables by name only.

## Pinned versions

- APISIX `apache/apisix:3.13.0-debian` (SD-7).
- OPA `openpolicyagent/opa:1.4.2-static`.

## Layout

- `apisix/config.yaml` — standalone (file-driven) mode, JSON access logs, no
  server banner.
- `apisix/apisix.yaml` — one route per provider plus `/health`. Each provider
  route runs `openid-connect` (bearer-only, JWKS, pinned issuer) then `opa`
  (per-provider policy, `with_route`), then `serverless-post-function` builds
  the `/v1` fixture body after authorization.
- `opa/*.rego` — provider policies with unit tests (`opa test gateway/opa`).
- `fixtures/*.json` — the golden `/v1/me` and `/v1/projects` bodies captured
  from the backend before deletion (A17).
- `test-issuers/` — local OIDC issuers used by the Docker integration script.
  They never call a real provider.

## Why OPA, not `openid-connect` alone (GW-3)

`openid-connect` `required_scopes` is evaluated only on the introspection path,
and introspection is excluded because it would require a client secret
(SD-11). `claim_validator` can express only issuer and audience presence. So
`openid-connect` performs the cryptographic validation (signature, `iss`,
`aud` presence, `exp`/`nbf`, algorithm) and the `opa` plugin performs the
per-provider scope, claim and method rules, returning the `X-User-*` headers
and a `reason` for the access log.

## Secret placeholders

The `openid-connect` schema requires `client_secret`, `client_id` and
`discovery` even for bearer-only routes. Bearer-only local verification never
calls the token endpoint, so the secret is unused. Route values are
`${{...}}` environment references; the local Compose stack supplies test
values, and **no secret value is stored in this repository**.

## Run locally

```sh
docker compose -f gateway/docker-compose.yml up
```

The gateway listens on `http://localhost:9080`; OPA on `:8181`.

## Checks

```sh
bun test gateway        # Docker-free route config assertions
opa test gateway/opa    # Rego policy unit tests
```

The Docker integration gate is `gateway/test-issuers/run-acceptance.sh`; it
runs only when Docker is available. Record which gate ran in the PR.
