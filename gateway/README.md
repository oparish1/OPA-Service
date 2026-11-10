# Gateway

The Apache APISIX gateway is the only authority for the browser app. It
validates every token, authorizes each provider's claims and serves the `/v1`
demo bodies itself. `fixtures/` holds the golden bodies captured from the
backend before deletion, and `config.test.ts` asserts the served bodies match
them (A17). It holds **no identity-provider secret** (SD-11): the route file
references environment variables by name only.

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
- `opa/*.rego` — provider shims that keep the historical APISIX package names
  and delegate to the wrappers in `../authz-service/authz/v1/gateway/`, which
  import the shared `authz-service/authz/` claim rules and keep only the
  gateway-only audience/issuer checks (`opa test authz-service gateway/opa`).
- `../authz-service/authz/` — the one shared Rego source the wrappers enforce
  and the browser compiles to WASM for advisory UI decisions. The capability
  catalogue, role hierarchy, claim-to-role map and route table are the static
  tables beside the engine (`catalogue.json`, `roles.json`, `role_map.json`,
  `routes.json`); the provider files under `providers/` supply only claim
  logic. The route labels carry environment values only — role and group
  labels are gone, because the role names come from the shared map. UI
  authorization is advisory; the gateway enforces.
- `fixtures/*.json` — the golden `/v1/me` and `/v1/projects` bodies captured
  from the backend before deletion (A17).
- `test-issuers/` — local OIDC issuers used by the Docker integration script.
  They never call a real provider.

## Why OPA, not `openid-connect` alone (GW-3)

`openid-connect` `required_scopes` is evaluated only on the introspection path,
and introspection is excluded because it would require a client secret
(SD-11). On the JWKS path `claim_validator` applies only `issuer`, so the plugin
performs the cryptographic validation (signature, `iss`, `exp`/`nbf`, algorithm)
and the `opa` plugin owns the audience plus the per-provider scope, claim and
method rules. OPA returns the `X-User-*` headers and, on deny, the `X-Auth-*`
audit headers the access log reads. The browser compiles the same
`authz-service/authz/` package to WASM for advisory nav and button decisions; it never
replaces the gateway decision.

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

The gateway listens on `https://localhost:9080`; OPA on `:8181`.

## Checks

Install the gateway dependencies once on a fresh clone, then run the gates from
the repository root:

```sh
cd gateway && bun install --frozen-lockfile
cd ..
bun test gateway        # Docker-free route config assertions
opa fmt --fail --list authz-service gateway/opa
opa check --strict authz-service gateway/opa
opa test authz-service gateway/opa    # shared policy, wrappers and the golden table
```

The Docker integration gate is `bun run gateway/test-issuers/acceptance.ts`; it
runs only when Docker is available. Record which gate ran in the PR.
