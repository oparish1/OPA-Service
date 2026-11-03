# Your Identity

A signed-in workspace for exercising protected APIs with Microsoft Entra, Okta
and Google. The app is **browser-only**: a React + Vite static SPA signs users
in directly with each identity provider, keeps tokens in memory only, and calls
APIs through an Apache APISIX gateway that validates every token and is the
single authorization authority. There is no backend-for-frontend and no
identity-provider secret in the app, the repository or the gateway route files.

Each identity provider lives entirely in its own folder so it can be taken on
its own:

- `frontend/src/core/` holds provider-neutral code; `gateway/opa/` holds the
  provider-neutral policy helpers.
- `frontend/src/providers/{entra,okta,google}/` and the matching
  `gateway/opa/<id>.rego` hold one provider each.
- `frontend/src/providers/index.ts` is the single frontend registry that
  composes the providers; `shared/providers.ts` remains the provider-neutral
  wire contract; `shared/app-config.ts` is the shared public-config schema.
- `shared/provider-isolation.ts` enforces that only the registries,
  `shared/providers.ts`, `shared/app-config.ts`, the per-provider folders and
  `gateway/apisix/apisix.yaml` name more than one provider.

Adding a provider touches its folder, its `gateway/opa/<id>.rego` and its route
in `gateway/apisix/apisix.yaml`, adds its id to `shared/providers.ts` and adds
one registry entry; removing one deletes those.

## Architecture

```
Browser (static app, tokens in memory only)
  | code + PKCE (Entra, Okta)        | Google Identity Services ID token
  v                                  v
Entra / Okta / Google  <-- sign-in happens here directly
  |
  | Authorization: Bearer <access token | Google ID token>
  v
APISIX gateway: one route per provider, own issuer, audience, key source and claim rules
  |
  v
/v1 responses built by the gateway
```

The gateway runs in declarative (standalone) mode from `gateway/`. The
`openid-connect` plugin verifies each bearer token (signature, `iss`, `exp`,
`nbf`, algorithm) and the `opa` plugin enforces the per-provider audience,
scope, claim and method rules, then sets `X-User-Issuer`, `X-User-Subject` and
`X-User-Provider` from the validated token. The gateway itself serves the
`/v1/me` and `/v1/projects` demo bodies; the golden bodies captured from the
backend before deletion are kept in `gateway/fixtures/` as the A17 reference.

## Local setup

Install the frontend dependencies with the committed lockfile:

```sh
cd frontend && bun install --frozen-lockfile
```

Run the app and the gateway together:

```sh
docker compose -f gateway/docker-compose.yml up
cd frontend && bun run dev
```

Copy `frontend/public/config.example.json` to `frontend/public/config.json`
and fill in the provider client IDs, issuers, the gateway URL and the O-20
account destinations. The example file is committed with placeholders only.

### Gateway configuration

`gateway/apisix/config.yaml` runs APISIX standalone, reads
`gateway/apisix/apisix.yaml` on startup, writes structured JSON access logs and
hides the server banner. `gateway/docker-compose.yml` pins an exact APISIX
image tag and a pinned OPA image, and mounts the configuration read-only.

The APISIX `openid-connect` plugin schema requires `client_secret`, `client_id`
and `discovery` even in bearer-only mode. Because bearer-only local
verification never calls the token endpoint, the client secret is unused. Per
SD-11 the route file references the placeholder environment variables by name
(`${{...}}`); **no secret value is stored anywhere in this repository**, and the
local Compose stack supplies only the local test-issuer values.

## Browser configuration

One static public file, loaded at runtime, carries the provider list, client
IDs, issuers, `entra.apiResource`, requested scopes, the gateway URL and the
account destination links (FE-1). `shared/app-config.ts` validates it and fails
the build when a value looks like a secret (long base64, a PEM private key, or
a `client_secret`-shaped value). The production file is deployment
configuration and is not committed; only
`frontend/public/config.example.json` is.

## Logging and mock mode

The browser writes through one provider-neutral logger in
`frontend/src/core/lib/log.ts`. It redacts token-shaped values and sensitive
keys, keeps the last 200 entries in memory, and exposes them as `window.__logs`
in development builds only. The optional public `logLevel` field
(`debug`, `info`, `warn` or `error`) sets the level; it defaults to `debug` in
development and `warn` in production. Every user-visible failure notice carries
a six-character reference that also appears in the matching log entry.

A missing or invalid `config.json` shows the configuration error screen; it
never starts the mock demo. The mock demo is opt-in with `?mock=1` in a
development build, for example `https://localhost:5173/?mock=1`.

## Browser request runner

The API screens call the gateway directly with `fetch`, an `AbortController`
timeout and a response-size cap. The runner may call only the configured
gateway origin, and the strict `connect-src` policy enforces the same rule. The
four Authorization options (session access token, `Bearer valid-token-123`,
`Bearer expired-token`, `no-token`) remain; the provider is chosen by route
prefix (`/entra/v1`, `/okta/v1`, `/google/v1`). Reveal and Copy read tokens
from memory and make no network request.

App tokens are held in memory only; the app itself never writes a token to
`localStorage`, cookies or IndexedDB. MSAL keeps its own token cache in
`sessionStorage` because its redirect flow needs a cache that survives the
provider round trip (SD-3). That library-scoped cache persists in the browser
until sign-out and is readable by any same-origin script, so an XSS on this
origin can read it; it is cleared on sign-out. The
30-minute idle and 8-hour absolute session limits are enforced in the browser as
a courtesy; the security bound is the token lifetime checked at the gateway.

## Checks

The frontend package defines its gates. Build before the tests so the A18
bundle scan inspects `dist/`:

```sh
cd frontend && bun run lint && bun run typecheck && bun run build && bun run test && bun run check:catch
```

`bun run check` runs the same sequence. `check:catch` enforces the no-silent-catch
rule over `frontend/src`.

The gateway has its own Docker-free gates; install its dependencies once on a
fresh clone:

```sh
cd gateway && bun install --frozen-lockfile
cd ..
bun test gateway                 # parses and asserts the APISIX route config
opa test gateway/opa             # Rego policy unit tests
```

The Docker Compose integration script
(`bun run gateway/test-issuers/acceptance.ts`) is the second gateway gate and
requires Docker; it exercises A9–A17 end-to-end against the local test issuers.

The provider boundaries have two extra checks, run from the repository root:

```sh
scripts/check-reuse-bundle.sh      # core + shared + one provider + registry typechecks
scripts/check-provider-deletion.sh # deleting a provider leaves the surviving suites green
```

The isolation check runs inside the frontend and gateway test suites.
