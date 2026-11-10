# IDP Architecture

A snapshot of the codebase after the browser-only migration (issue #12). See the
root `README.md` for setup, the public configuration file and the gateway
configuration.

## Project overview

- **"Your Identity"** is a signed-in workspace where developers see their real
  identity, session and tokens, and call protected APIs (`/v1/me`,
  `/v1/projects`) with them.
- It is built as a **static browser app plus an APISIX gateway**. The React SPA
  signs in directly with each identity provider, keeps tokens in memory only,
  and calls `/v1` through the gateway. The gateway validates every token and
  decides who may call what. There is no backend-for-frontend.
- **Providers:** Microsoft Entra ID, Okta and Google Workspace / Cloud Identity.
  The browser configuration file lists the enabled providers; a provider that is
  absent from `gateway/apisix/apisix.yaml` is disabled and its route returns 404.
- **Version:** 0.1.0.

## Direction change (issue #12)

This issue is the maintainer's explicit decision to replace the earlier
backend-for-frontend direction. The following earlier decisions are
**superseded** and must not be read as current: O-05, O-08, O-09, O-10, O-15,
the server-side request runner and its safety rules, Invariant 5's server-side
session rules, and "Entra frontend and backend must remain untouched".

The BFF direction is recorded only for history in
`docs/auth/add-authentication-work-order.md` (now banner-marked superseded) and
in `.archon/design-decisions.md`. The Round 3/4/5 UI decisions remain binding
except where issue #12 explicitly reverses them.

## Architecture

- **Rule: each provider stays in its own folder.**
  - `frontend/src/core/` holds provider-neutral browser code;
    `authz-service/authz/v1/gateway/` holds provider-neutral Rego helpers.
  - `frontend/src/providers/{entra,okta,google}/` hold one provider each;
    `authz-service/authz/v1/gateway/{entra,okta,google}.rego` hold one
    provider's authorization policy each; the published bundle exposes them at
    `authz/v1/gateway/{entra,okta,google}`.
  - `frontend/src/providers/index.ts` is the single frontend registry;
    `shared/providers.ts` defines `PROVIDER_IDS`; `shared/app-config.ts` defines
    the public-config schema.
  - `shared/provider-isolation.ts` fails the frontend and gateway suites if any
    other file names more than one provider id.
- **Browser auth core** (`frontend/src/core/`):
  - `providers/types.ts` is the one interface each provider folder implements:
    sign in, handle redirect, get access token, renew, sign out and session
    info, plus the parsed public-config slice.
  - `session/store.ts` is the only writer of tokens; it holds them in memory and
    owns the 30-minute idle and 8-hour absolute timers.
  - `api/runner.ts` is the direct gateway client: fixed gateway origin, an
    `AbortController` timeout, a response-size cap and the shared header
    allowlist.
  - `main.tsx` loads and validates `config.json`, installs the registry, handles
    the provider redirect callback and renders the app.
  - `authz/` evaluates the shared `authz-service/authz/` Rego compiled to WASM once
    after sign-in and again after a renewal changes claims, caches one
    capability map and fails closed to a baseline floor. UI authorization is
    advisory; the gateway enforces.
- **Gateway** (`gateway/`):
  - `apisix/config.yaml` runs APISIX in declarative mode with JSON access logs,
    no server banner and strict security headers.
  - `apisix/apisix.yaml` declares one route per provider plus a tokenless health
    route. Each authenticated route runs `openid-connect` (bearer-only, JWKS)
    for cryptographic validation and `opa` for audience, scope, claim and method
    authorization, then `serverless-post-function` builds the `/v1` golden
    fixture body.
  - `authz-service/authz/v1/gateway/*.rego` import the shared
    `authz-service/authz/` claim rules, keep only the gateway-only audience and
    issuer checks, and return `allow`, the `X-User-*` headers, and on deny the
    `X-Auth-*` audit headers (provider, subject, decision, reason) the access
    log reads for GW-8. The published bundle carries those wrappers and the
    `opa` service loads it in signed bundle mode with signature verification.
  - `fixtures/` holds the `/v1` golden bodies captured from the deleted backend.
  - `test-issuers/` is the local OIDC issuer the Docker integration script uses;
    it never calls a real provider.
- **Tokens** are held in browser memory only. Per SD-3, a library without an
  in-memory option may use `sessionStorage` for that library only, with the risk
  recorded in the README and an A4 exception test. Tokens are never logged and
  never placed in a URL.
- **Accounts** are not linked by email; the gateway keys each request on the
  validated `(provider, issuer, subject)`.

## Tech stack

- **Language:** TypeScript (~5.6) everywhere. Bun is the runtime and package
  manager, with lockfiles committed.
- **Frontend:** React 18, Vite 5, lucide-react, `@azure/msal-browser`,
  `@okta/okta-auth-js` and the Google Identity Services script. Tests use
  Vitest 2, Testing Library and jsdom.
- **Gateway:** Apache APISIX (pinned 3.13.0) in declarative mode, the APISIX
  `opa` plugin with Rego 1.x policies, run with Docker Compose.
- **Linting and CI:** ESLint 9 with typescript-eslint. GitHub Actions runs
  frontend checks, gateway checks and a gitleaks secret scan.
- **Tooling:**
  - `.archon/` holds Archon agent workflows for ship, audit, security gate,
    Figma and change readiness.
  - `.claude/skills/` holds deploy, CI and auth skills.

## Conventions

- Each module has a single owner, written down in doc comments like "the only
  file that names every provider" or "one owner".
- Closed enums and error codes such as `duplicate_provider_id:…` and
  `blocked_host`. It fails closed: unknown origins send nothing, an unset link
  is hidden, and a disabled provider route is absent.
- Tests sit next to each provider (`frontend/src/providers/*/__tests__`) and
  cover gateway behaviour in `gateway/config.test.ts` and `authz-service/test/*_test.rego`.
- Commit messages are short and imperative, describing the result.
- **Checks:** `bun run lint && bun run typecheck && bun run build && bun run test && bun run check:catch && bun run check:authz`
  in `frontend/`; `bun test gateway` and `opa test authz-service` from the root.
  The two provider-boundary scripts run from the repository root.

## Catalogue-driven authorization (issue #24)

The shared policy is data-driven. `authz-service/authz/` holds the neutral Rego
engine and the four static tables (`catalogue.json`, `roles.json`,
`role_map.json`, `routes.json`); the engine derives every capability set, the
effective roles and the per-capability deny set from them. Each
`authz-service/authz/providers/` file keeps only its own claim logic.
`frontend/src/core/authz/generated.ts` and
`authz-service/fixtures/matrix.snapshot.json` are generated from the policy by
`bun run gen:authz` and checked by `bun run check:authz` in CI, so the browser
types and the decision grid cannot drift from the gateway rules.
