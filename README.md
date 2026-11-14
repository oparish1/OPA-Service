# Your Identity

A signed-in workspace for exercising protected APIs with Microsoft Entra, Okta
and Google. The app is **browser-only**: a React + Vite static SPA signs users
in directly with each identity provider, keeps tokens in memory only, and calls
APIs through an Apache APISIX gateway that validates every token and is the
single authorization authority. APISIX runs outside this repository; this repo
holds only the frontend and the shared files it imports. There is no
backend-for-frontend and no identity-provider secret in the app or the
repository.

Each identity provider lives entirely in its own folder so it can be taken on
its own:

- `frontend/src/core/` holds provider-neutral code.
- `frontend/src/providers/{entra,okta,google}/` hold one provider each.
- `frontend/src/providers/index.ts` is the single frontend registry that
  composes the providers; `shared/providers.ts` remains the provider-neutral
  wire contract; `shared/app-config.ts` is the shared public-config schema.
- `shared/provider-isolation.ts` enforces that only the registries,
  `shared/providers.ts`, `shared/app-config.ts` and the per-provider folders
  name more than one provider.

Adding a provider touches its folder, its policy in `oparish1/authz-policy`, and
its APISIX route outside this repo, adds its id to `shared/providers.ts` and
adds one registry entry; removing one deletes those.

## Architecture

```
Browser (static app, tokens in memory only)
  | code + PKCE (Entra, Okta)        | Google Identity Services ID token
  v                                  v
Entra / Okta / Google  <-- sign-in happens here directly
  |
  | Authorization: Bearer <access token | Google ID token>
  v
APISIX gateway (outside this repository): one route per provider
  |
  v
/v1 responses built by the gateway
```

The browser evaluates the published `policy.wasm` for advisory UI hints and
calls the configured APISIX gateway for every real request. APISIX runs in
declarative (standalone) mode outside this repository; its `openid-connect`
plugin verifies each bearer token (signature, `iss`, `exp`, `nbf`, algorithm)
and its `opa` plugin enforces the per-provider audience, scope, claim and method
rules. The policy itself lives in `oparish1/authz-policy`; the browser reads the
same published WASM. **UI authorization is advisory; APISIX enforces every
request.**

## Local setup

Install the frontend dependencies with the committed lockfile:

```sh
cd frontend && bun install --frozen-lockfile
```

Run the app against an APISIX gateway that is already reachable at the configured
`gatewayUrl`:

```sh
cd frontend && bun run dev
```

Copy `frontend/public/config.example.json` to `frontend/public/config.json`
and fill in the provider client IDs, issuers, the gateway URL and the O-20
account destinations. The example file is committed with placeholders only.
The example's `https://localhost:9080` assumes a TLS terminator in front of
APISIX, as in production.

### Gateway configuration

APISIX runs outside this repository. Configure one route per provider there,
with its own issuer, audience, key source and claim rules, and point the
browser's `gatewayUrl` at that deployment. The policy that the gateway and the
browser share lives in `oparish1/authz-policy`; changing it is a change in that
repository, not here.

Per SD-11 the gateway route files reference placeholder environment variables by
name; **no secret value is stored anywhere in this repository**.

## Browser configuration

One static public file, loaded at runtime, carries the provider list, client
IDs, issuers, `entra.apiResource`, requested scopes, the gateway URL and the
account destination links (FE-1). `shared/app-config.ts` validates it and fails
the build when a value looks like a secret (long base64, a PEM private key, or
a `client_secret`-shaped value). The production file is deployment
configuration that overrides the committed demo `frontend/public/config.json`;
the example file `frontend/public/config.example.json` carries placeholders only.

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

## Advisory UI authorization

The policy lives once in `oparish1/authz-policy` (Rego v1). Its capability
catalogue, role hierarchy, claim-to-role map and route table are non-secret
static data published in the `authz-contract` package; the engine derives every
capability set, the effective roles and the per-capability deny set from them,
and names no capability, role or provider. The browser downloads the pinned
policy and contract with `bun run sync:policy`.

The browser evaluates the policy once after sign-in and again when a renewal
changes the claims, to hide menu items and disable buttons with an accessible
reason. A failed load or malformed result leaves the UI at the baseline floor
(Overview and Account) with `permissions_unavailable`. **UI authorization is
advisory; APISIX enforces every request.** Setting `authz.enabled` to `false`
in the public config (default `true`) skips the evaluation and restores the
pre-change behavior without touching the gateway.

### Using the WASM policy

The browser evaluates the published policy from WASM; there is no gateway
capability source. Run `bun run sync:policy` once to download the release pinned
in `frontend/policy/VERSION` into `frontend/public/policy/` (gitignored) and the
matching `authz-contract` package into `frontend/policy/contract/` (gitignored).
The command verifies every release file's SHA-256 and byte count against the
release manifest and checks that the release catalogue covers every contract
capability. `prebuild` and `predev` run it automatically, so `bun run build` and
`bun run dev` always use a verified artifact; a hash mismatch, a missing file or
a version mismatch fails the build.

The download needs `oras` and `tar` on the path. `oparish1/authz-policy` is
private. Locally the release download uses `gh`, so sign in with
`gh auth login` or set `GH_TOKEN` to a PAT with read access to that repository;
the frontend CI job reads the same PAT from the `AUTHZ_POLICY_READ_TOKEN`
repository secret. `bun run sync:policy -- --latest` reports the newest published
tag without changing the pin; to upgrade, edit `frontend/policy/VERSION`, run
`bun run sync:policy`, then run `bun run gen:authz`. The WASM decision is
advisory UI hints only — APISIX remains the sole enforcer.

The downloaded contract's `fixtures/personas.json` and
`fixtures/matrix.snapshot.json` are the persona decision grid. The browser parity
test asserts the evaluated WASM equals the matching snapshot entry for every
persona; `bun run sync:policy` must run before `bun run test` for that check to
run locally (CI builds first).

### How to add a capability, a role or a route

Policy changes belong in `oparish1/authz-policy`, not in this repository. In
that repository:

- **Capability.** Add one entry to `authz/catalogue.json` (`{"kind": "read" |
  "write" | "baseline", "role": <role or null>, "scope": "workspace:read" |
  "workspace:write" | null}`) and a route entry to `authz/routes.json` when it is
  API-backed.
- **Role.** Add one entry to `authz/roles.json` with its flattened `includes`,
  map the provider claim values in `authz/role_map.json`, and use it in
  catalogue entries. No Rego change.
- **Route.** Add `{"suffix": ..., "capability": ...}` to `routes.json`; the
  longest matching suffix wins, and an unmatched request falls back to the
  admin-only `data.unmapped` (safe method) or `action.unmapped.write` (unsafe
  method) capability, so a forgotten route fails closed.

Then release `oparish1/authz-policy`, bump the pin in `frontend/policy/VERSION`,
run `bun run sync:policy` and `bun run gen:authz`, and commit the regenerated
`frontend/src/core/authz/generated.ts`. CI runs `bun run check:authz` and fails
when it is stale.

## Checks

The frontend package defines its gates. Build before the tests so the A18
bundle scan inspects `dist/`:

```sh
cd frontend && bun run lint && bun run typecheck && bun run build && bun run test && bun run check:catch && bun run check:authz
```

`bun run check` runs the same sequence. `check:catch` enforces the no-silent-catch
rule over `frontend/src`.

The provider boundaries have two extra checks, run from the repository root:

```sh
scripts/check-reuse-bundle.sh      # core + shared + one provider + registry typechecks
scripts/check-provider-deletion.sh # deleting a provider leaves the surviving suites green
```

The isolation check runs inside the frontend test suite.
