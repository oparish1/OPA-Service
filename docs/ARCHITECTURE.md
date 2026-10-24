# IDP Architecture

A snapshot of the codebase as of 2026-10-24 (`main` at `73ca63f`). See the root
`README.md` for setup, environment variables and the request-runner safety rules.

## Project overview

- **"Your Identity"** is a signed-in workspace where developers see their real identity, session and tokens, and call protected APIs (`/v1/me`, `/v1/projects`) with them.
- It's built as a **BFF (backend-for-frontend)**. A React SPA talks to a Bun + Fastify backend, which runs the OIDC sign-in flow and keeps tokens on the server. The browser never receives an access token.
- **Providers:** Microsoft Entra ID is always on. Okta (`OKTA_ENABLED`) and Google Workspace (`GOOGLE_ENABLED`) are opt-in. If you enable one without its required variables, the backend refuses to start.
- **Version:** 0.1.0. It started from mocks, and Entra sign-in was built from `docs/auth/add-authentication-work-order.md`.

## Architecture

- **Rule: each provider stays in its own folder.**
  - `backend/src/core/` and `frontend/src/core/` hold code that doesn't belong to any one provider.
  - `{backend,frontend}/src/providers/{entra,okta,google}/` hold one provider each.
  - `{backend,frontend}/src/providers/index.ts` are the only registries: `PROVIDER_MODULES` lists all three.
  - `shared/providers.ts` defines `PROVIDER_IDS` and the `ProviderInfo` format the backend sends to the frontend.
  - `shared/provider-isolation.ts` fails both test suites if any other file names more than one provider id.
- **Backend provider module** (`backend/src/core/provider.ts`): each provider supplies its env schema (zod), an `enabled()` check, `requirements()`, `parse()` and `createDefinition()`. A definition carries the OIDC service, bearer-token validator, claim checks (`gate`), how to get the subject and profile, and an optional refresh-token revoke.
- **Backend core:**
  - `app.ts` wires up helmet (strict CSP), cookies, rate limiting and a global auth guard (`onRequest`).
  - Route groups: `auth`, `session`, `request-runner` and `v1`. A route inventory test checks every route's auth level.
  - Supporting pieces: SQLite `Store`, `TokenCipher` (token encryption with key rotation), `AuditLogger`, CSRF/Origin checks, a refresh lock, and a daily retention job.
- **Accounts** are keyed on `(provider, issuer, subject)` and never linked by email.
- **Request runner** (`POST /api/request-runner`): a server-side GET relay with a host allowlist, no redirects, a 10s timeout, a 1 MiB body cap and filtered headers. It attaches the session token only when the target is the app's own origin. Google sessions are routed in-process through the app's own router instead of making an outbound call.
- **Frontend:**
  - A screen switcher (`App.tsx`) across 7 screens, with `AppProvider` holding app state.
  - `api/client.ts` is the real backend client, used when `VITE_AUTH_MODE=entra`; otherwise it uses `mocks/`.
  - Components follow a Figma design system, and `.archon/design-decisions.md` holds binding UI decisions.

## Tech stack

- **Language:** TypeScript (~5.6) everywhere. Bun is the runtime and package manager, with lockfiles committed.
- **Backend:** Fastify 5, openid-client 6, jose 6, zod 4, `@fastify/{cookie,helmet,rate-limit,static}`. Tests use `bun test`.
- **Frontend:** React 18, Vite 5, lucide-react. Tests use Vitest 2, Testing Library and jsdom.
- **Linting and CI:** ESLint 9 with typescript-eslint. GitHub Actions runs separate backend and frontend checks plus a gitleaks secret scan.
- **Tooling:**
  - `.archon/` holds Archon agent workflows for ship, audit, security gate, Figma and change readiness.
  - `.claude/skills/` holds deploy, CI and auth skills.

## Conventions

- Each module has a single owner, written down in doc comments like "the only file that names every provider" or "one owner".
- Closed enums and error codes such as `duplicate_provider_id:…` and `blocked_host`. It fails closed: `trustProxy: () => false`, and nothing is invented (an unset link is hidden).
- Tests sit next to each provider (`providers/*/__tests__`) and cover core behaviour in `backend/test/`. Neutral fake providers in `core/testing/` let core tests run without any real provider.
- Commit messages are short and imperative, describing the result ("Correct…", "Isolate…", "Let…").
- **Checks:** `bun run lint && bun run typecheck && bun run test` in each package. From the repo root, two more scripts check provider boundaries: `scripts/check-reuse-bundle.sh` and `scripts/check-provider-deletion.sh`.

## Known issues (as of this snapshot)

- The README's opening paragraph still says "a real Microsoft Entra ID session", but Okta and Google are supported too.
- The `docs.path` setting in `.archon/config.yaml` points to `packages/docs-web/...`, which doesn't exist in this repo. It's probably a leftover template value.
- Stray `.DS_Store` files are tracked in git.
