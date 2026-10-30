> **SUPERSEDED (issue #12).** This work order describes the backend-for-frontend
> (BFF) direction that issue #12 replaced. It is kept for history only. The
> app is now browser-only: the SPA signs in directly with Entra, Okta and
> Google, keeps tokens in memory, and calls `/v1` through the APISIX gateway,
> which is the only authorization authority. `backend/` no longer exists. Do
> not implement anything below as written; see `docs/ARCHITECTURE.md` and
> `.archon/design-decisions.md` for the current direction.

# Work order: Microsoft Entra ID sign-in for the Your Identity workspace

- **Prepared:** 2026-10-14, using the `add-authentication` skill
- **Owner:** repo owner (also the Entra tenant administrator)
- **Status:** ready for triage → plan → deliver
- **Human gate:** this change is security-sensitive. It merges only after a human reviews the pull request. Do not auto-merge any phase.

---

## 1. Problem

The repo holds only a React 18 + TypeScript SPA (`frontend/`, built with Vite and bun). **All authentication is mocked:**

- `frontend/src/mocks/api.ts` fakes `signIn`, `discoverSso`, `getSession`, `refreshToken`, `runRequest`, `connectProvider`, `resetPassword` and `changePassword`. Each returns canned data from `frontend/src/mocks/data.ts` after a delay.
- The "session" is a module variable (`activeSession`). It is lost on reload and enforces nothing.
- There is no backend, no user store, no cookie, no IdP SDK, no CSRF protection, no rate limiting and no audit logging.
- `/v1/me` and `/v1/projects` (`api.agadv.example`) are mock responses. No server exists.

A static SPA cannot enforce authentication. Anyone can call any endpoint because no endpoint exists. Real sign-in needs a server to run the OIDC flow, validate tokens and hold sessions.

The UI already commits to an SSO-only model:

- "We never collect your password."
- Forgot and Change password hand off to the provider.
- "Your first sign-in creates your account automatically."

This work order makes that model real for **one provider, Microsoft Entra ID**.

## 2. Why / why now

The workspace's purpose is to show a developer their real identity, session and tokens, and to let them call protected APIs with those tokens. With mocks, none of that is real. The owner wants Agentic Advantage employees to sign in with the organisation's Entra tenant.

Stakes, per the owner: a compromised account can **read its own profile and project list** (`workspace:read`, `workspace:write`). It cannot change shared data. There is no regulated data. Entra Conditional Access enforces MFA. There is no deadline.

## 3. Outcome

When this work order is done:

- **Sign-in:**
  - An Agentic Advantage employee who is **assigned to the app in Entra** clicks "Continue with Microsoft Entra ID", authenticates at Entra (with MFA via Conditional Access) and lands on Overview with a real server-side session.
  - Their account is created on first sign-in (JIT).
- **Rejected users:**
  - A tenant user who is **not** assigned (and does not hold the app role) is refused. No account is created.
  - A user from any other tenant, or with a personal Microsoft account, is refused.
- **Overview** shows real session data: display name, `oid`-based account id, issuer, issued-at, and access/refresh token expiry and scopes. Per the owner's decision (D-10), it can also reveal the real access token and refresh token, with compensating controls.
- **APIs:** `GET /v1/me` and `GET /v1/projects` are served by the new BFF and require authentication. `/projects` returns the stub data from `.archon/design-decisions.md`.
- **Refresh and sign-out:**
  - "Refresh session" performs a real refresh-token grant on the server.
  - Sign out destroys the server session (D-08 decides whether Entra is also signed out).
- **Audit:** every sign-in, refusal, refresh, token reveal and sign-out is audit-logged.

**In scope:** Microsoft Entra ID via OIDC (authorization code + PKCE, confidential client) in a new backend-for-frontend (BFF).

**Deferred (hidden in the UI until built, per owner):**

- Okta and Google Workspace sign-in buttons
- the "Organisation SSO" row
- the "Connect" / account-linking action on Account & identity
- multi-tenant or customer-organisation SSO
- SAML
- SCIM provisioning

**Not applicable (do not build):** local passwords, password reset/change inside the app, email verification, app-level MFA, social login. The Forgot/Change password screens remain hand-offs to the provider's own pages.

## 4. Invariants (must not break)

1. **No local credentials.** The app never receives, stores or forwards a user password. There is no password endpoint of any kind.
2. **Existing users / migration:** there are none. The app has never had real accounts, so there are no hashes to migrate and no live sessions to preserve. If that changes before delivery, stop and re-plan.
3. **Design contract:** screens, copy, states and components stay as approved in `.archon/design-decisions.md` and the Figma prototype. The only exceptions are the deferred rows/buttons, which are hidden, and the "DEMO VALUE" labels on token values, which must change because the values become real (see D-15).
4. **Frontend checks stay green:** `bun run lint`, `bun run typecheck` and `bun run test` in `frontend/`, as run by `.github/workflows/frontend-checks.yml`.
5. **The mock layer stays usable for tests.** Component tests keep using `configureMocks`/`resetMocks`. The real client replaces the mock behind the same function signatures, so it is a seam swap, not a rewrite of every screen.
6. **Authorization is unchanged in shape.** Every authenticated user can read only their own profile and the (stub) project list. This work order adds no roles beyond "may use the app" (see §9).

## 5. Acceptance (testable)

Each statement needs at least one automated test, unless marked *manual*. Negative tests are mandatory.

| # | Statement | Control |
|---|---|---|
| A1 | `GET /auth/login` redirects to the Entra v2.0 authorize endpoint discovered from the tenant's `/.well-known/openid-configuration`. The redirect carries `response_type=code`, `code_challenge_method=S256`, a fresh `state`, a fresh `nonce` and the exact registered `redirect_uri`. | OIDC / sso.md §3 |
| A2 | The callback rejects: a missing `state`, a mismatched `state`, a reused `state`, a missing PKCE verifier, and an expired login transaction (D-12). Each produces a generic error page, no session and an audit event. | OIDC / CSRF on login |
| A3 | ID token validation rejects each of the following (one test each, using a locally signed test JWKS): bad signature; `iss` ≠ `https://login.microsoftonline.com/{TENANT_ID}/v2.0`; `tid` ≠ configured tenant; `aud` ≠ client ID; expired `exp`; mismatched `nonce`. | sso.md §3, §6 |
| A4 | A valid token **without** the required app role (D-04) is refused. No user row is created and the refusal is audit-logged. | JIT gating |
| A5 | A valid token with the role creates a user keyed on (`tid`, `oid`) on first sign-in. A second sign-in reuses that row. Two different `oid`s with the same `email`/`preferred_username` produce two separate users. | sso.md §5 (never key on email) |
| A6 | After sign-in the session id differs from any pre-login id (fixation test). The cookie is `__Host-` prefixed with `HttpOnly`, `Secure`, `Path=/`, no `Domain` and `SameSite` per D-07. | Cookies / session lifecycle |
| A7 | A session idle for longer than 30 min is rejected. A session older than 8 h absolute is rejected even if it was active. Both checks are enforced server-side. | D-01, D-02 |
| A8 | `POST /auth/logout` destroys the server-side session. Re-using the old cookie afterwards returns 401. | Session lifecycle |
| A9 | Every state-changing cookie-authenticated endpoint (`POST /auth/logout`, `POST /api/session/refresh`, `POST /api/session/tokens/reveal`) rejects a request with a missing or invalid CSRF token, or a foreign `Origin`. | CSRF |
| A10 | `GET /v1/me` and `GET /v1/projects` return 401 with no session/valid bearer. A **route inventory test** fails if any non-public route is registered without the auth guard. | Authorization separate |
| A11 | If bearer access to `/v1/*` is in scope (D-14), the following are rejected: an access token for another audience; an expired token; a token signed with an unknown key; a token from another tenant. | sso.md §8 |
| A12 | Token reveal returns values only to the session owner, only via `POST`, with `Cache-Control: no-store`. Each reveal writes an audit event. Token values never appear in any log line: a test greps captured logs for the test token strings. | D-10 compensating controls |
| A13 | Refresh tokens and access tokens are stored server-side and encrypted at rest. A stored refresh token is replaced on every refresh, and the old one is deleted (Entra does not revoke it — see refs). | Secrets / tokens |
| A14 | Rate limiting applies to `/auth/login`, `/auth/callback`, `/api/session/refresh` and `/api/session/tokens/reveal`. It is keyed per source IP and per session/user, with the D-05 thresholds. Exceeding a limit returns 429 and writes an audit event. | Brute force |
| A15 | Error responses contain no stack trace, no Entra error body and no token material. Entra `error_description` is logged server-side only. | Errors |
| A16 | Responses carry security headers: a CSP that allows no inline script and no third-party script origins, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, frame-ancestors `'none'`, and HSTS in production. | Headers / D-10 |
| A17 | No secret is present in the repo. CI runs a secret scan, and the BFF refuses to start if any required env var is missing. | Secrets |
| A18 | *Manual:* an Entra user removed from the app assignment cannot start a new session. An existing session ends within the D-03 bound. | Deprovisioning |
| A19 | The SPA shows only the Entra button. The Okta, Google and Organisation SSO buttons, the email-domain SSO form and the "Connect" actions are not rendered when the feature flag (§11) is off. | Scope |
| A20 | Audit events (§7 baseline) are emitted with actor (`oid`), time, source IP, user agent and outcome, and are retained for 90 days (D-06). | Audit logging |

## 6. Decisions and commitments

`owner` = decided by the owner in the 2026-10-14 interview. `unresolved` = **not decided**. The suggestion is labelled as such and must be confirmed by the owner before the phase that needs it ships.

| ID | Item | Value | Source | Owner's words / resolving question |
|---|---|---|---|---|
| D-00 | Backend | New BFF service, TypeScript, same origin as the SPA | owner | "New BFF service"; "TypeScript on Bun/Node"; "Same origin" |
| D-01 | Session idle timeout | 30 minutes | owner | "30 min idle / 8 h absolute" |
| D-02 | Session absolute timeout | 8 hours | owner | as above |
| D-03 | Deprovisioning bound | ≤ 8 h, because removal takes effect at the next sign-in / absolute timeout | owner (implied by D-02 + "JIT, gated by group") | Faster removal would need SCIM or per-request revalidation. Confirm 8 h is acceptable. |
| D-04 | Who may sign in | Users/groups assigned to the Entra enterprise app ("Assignment required? = Yes"), plus a required app role checked server-side | owner ("JIT, gated by group"); the role check is a design control, see note ¹ | — |
| D-05 | Rate-limit thresholds | **unresolved** | unresolved | *Suggestion (not decided):* `/auth/login` and `/auth/callback` 20 req/min per IP; refresh 10/min per session; reveal 10/min per session. Entra already handles credential brute force. Question: "What limits on login/callback/refresh/reveal?" |
| D-06 | Audit log retention | 90 days | owner | "90 days" |
| D-07 | Session cookie `SameSite` | **unresolved** | unresolved | *Suggestion:* `Lax` for the session cookie (survives the top-level return from Entra) with CSRF tokens + `Origin` checks. `Lax` is mandatory for the short-lived login-transaction cookie. OWASP prefers `Strict` where it works. |
| D-08 | Logout behaviour at Entra | **unresolved** | unresolved | *Suggestion:* clear the app session and redirect to Entra's `end_session_endpoint` with `post_logout_redirect_uri`. Question: "Should signing out of the workspace also sign the user out of Microsoft?" |
| D-09 | Break-glass | None in the app. During an Entra outage the app is unavailable; tenant recovery uses Entra's own emergency-access accounts | owner | "No app break-glass" |
| D-10 | Token display on Overview | Reveal **both** real access token and real refresh token | owner — **accepted risk**, see §10 R1 | "Keep both" |
| D-11 | MFA | Enforced by Entra Conditional Access, not by the app | owner | "Entra enforces MFA". *Unresolved sub-item:* should the BFF additionally require the `amr` claim to contain `mfa`? Suggestion: no, because CA is authoritative, but log `amr`. |
| D-12 | Login transaction (state/nonce/PKCE) lifetime | **unresolved** | unresolved | *Suggestion:* 10 minutes, single use. |
| D-13 | Session/user store | **unresolved** | unresolved | No database exists. *Suggestion:* PostgreSQL for `users`, `sessions` and `audit_events`. SQLite is acceptable only for a single-instance deployment. Question: "What database, and where is it hosted?" |
| D-14 | `/v1/*` authentication mode | **unresolved** | unresolved | The SPA's RequestPanel sends a bearer token (`runRequest(token, endpoint)`). *Suggestion:* `/v1/*` accepts **either** the session cookie **or** an Entra access token whose `aud` is this app's exposed API. The API Explorer then calls it with the revealed token, as designed. Question: "Should the API Explorer send the real access token as a Bearer header?" |
| D-15 | "Expired token" demo in Projects API | **unresolved** | unresolved | Projects API starts with `EXPIRED_ACCESS_TOKEN` to demo the 401 recovery. *Suggestion:* keep the recovery UI, but trigger it only from a genuine 401. Seed the selector with the previously rotated (now expired) access token if one exists; otherwise start in the valid state. Change "DEMO VALUE" labels to real-value labels. |
| D-16 | Access token scopes | **unresolved** | unresolved | *Suggestion:* expose API scopes `workspace:read` and `workspace:write` on the app registration (UI copy already shows these). `api.read` appears in mocks with no consumer; drop it unless needed. |
| D-17 | Hosting / TLS termination | **unresolved** | unresolved | Same origin is decided, but host, reverse proxy and TLS are not. Needed for the exact redirect URI and the `__Host-` cookie. |
| D-18 | Compliance regime | None | owner | "none" |
| D-19 | Timeline | No deadline | owner | "no deadline" |

¹ Microsoft documents that **Global Administrators bypass "Assignment required"** ([Restrict an app to a set of users](https://learn.microsoft.com/en-us/entra/identity-platform/howto-restrict-your-app-to-a-set-of-users)). Assignment alone therefore does not fully gate access. Define one app role (suggested value `Workspace.User`, *name unresolved*), assign it to the permitted group, and have the BFF require it in the ID token `roles` claim. App roles also avoid the groups-claim overage problem (more than 200 groups in a JWT drops the `groups` claim — [ID token claims reference](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)).

## 7. Cross-cutting baseline (skill Step 4)

| Control | How it is met | Acceptance |
|---|---|---|
| Transport & cookies | HTTPS only; `__Host-` session cookie, `HttpOnly`, `Secure`, explicit `SameSite` (D-07). The SPA never stores tokens in `localStorage`/`sessionStorage`. Revealed tokens live only in React state and are dropped on Hide, navigation and refresh (existing design rule). | A6, A12 |
| Session lifecycle | Session id regenerated at callback; 30 min idle / 8 h absolute enforced server-side; destroyed on logout. There are no password or factor changes in-app; Entra handles those. | A6–A8 |
| CSRF | Synchronizer token (or double-submit) plus `Origin` check on all state-changing cookie routes; `state` protects the login callback. | A2, A9 |
| Brute force | Rate limits on auth and token routes (D-05). Password brute force is Entra's responsibility. | A14 |
| No enumeration | There is no login form to enumerate. The email-domain discovery form (`discoverSso`) **is removed** while only Entra is in scope, because it would reveal which domains are configured. Callback errors are generic. | A2, A19 |
| Secrets | `ENTRA_CLIENT_SECRET` (or certificate — preferred, see §8), `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` come from env / the secrets manager. Rotation: support two active encryption/session keys (current + previous). Track Entra client-secret expiry (secrets expire; set a calendar alert). | A17 |
| Authorization separate | Global auth guard with an explicit public allow-list (`/auth/login`, `/auth/callback`, `/healthz`, static assets). Per-user authorization is "own data only"; anything richer is out of scope. | A10 |
| Audit logging | Events: `login.start`, `login.success`, `login.refused` (with reason: no role / wrong tenant / validation), `session.refresh`, `session.refresh.failed`, `token.reveal` (which token), `logout`, `rate_limited`. Fields: `oid`, `tid`, session hash (not the id), IP, UA, timestamp, outcome. **Never log tokens, codes, `state`, `nonce` or the PKCE verifier.** Retain for 90 days. | A12, A20 |
| Errors & headers | Generic client errors; Entra error details are logged server-side only; headers per A16. | A15, A16 |
| Tests | One negative test per row above; see §5. | all |

## 8. Libraries and providers

Verify versions and APIs against current docs at implementation time. The items below were checked on 2026-10-14.

| Need | Choice | Why it beat the alternative |
|---|---|---|
| OIDC client | **`openid-client` v6** (panva) — `discovery`, `buildAuthorizationUrl`, `authorizationCodeGrant`, `randomPKCECodeVerifier`, `calculatePKCECodeChallenge`, refresh grant. Supports Node ≥ 20 and Bun. [github.com/panva/openid-client](https://github.com/panva/openid-client) | A certified, maintained, provider-neutral library, so Okta/Google can be added later through the same code path. MSAL Node is the Microsoft-specific alternative; it is fine but locks the deferred providers into a second library. **Note:** the library's sample adds `state` only when PKCE is unsupported. This work order **requires `state` and `nonce` always** (A1–A3). |
| Bearer JWT validation (if D-14) | **`jose`** (panva) with a remote JWKS from the discovered `jwks_uri` | Maintained; handles key rotation and caching; no hand-rolled JWT code. |
| HTTP server | **Fastify** on the current Node.js LTS | Mature, maintained plugins for everything §7 needs: `@fastify/session` (server-side store), `@fastify/cookie`, `@fastify/csrf-protection`, `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/static` (serves the built SPA → same origin). Hono on Bun was considered: it is lighter, but its session/CSRF story would push us toward hand-rolled session code, which the skill forbids. Running the BFF on Bun is possible later; validate plugin compatibility first. |
| Session & user store | Per D-13 (unresolved). Use a maintained `@fastify/session`-compatible store for it; do not write a custom store. | — |
| Token encryption at rest | Node `crypto` AES-256-GCM via a small, reviewed wrapper, **or** a maintained envelope-encryption library / KMS if the host provides one | Prefer the platform KMS if D-17 lands on a cloud with one. |
| Client authentication to Entra | **Certificate credential** preferred over client secret | Entra client secrets expire, and a secret is a bearer credential. A certificate is easier to protect and rotate. Either way it comes from the secrets manager. |

**Entra registration (owner = tenant admin) must provide:** tenant ID, client (application) ID, the client certificate (or secret) stored in the secrets manager — **not** in the repo or chat — the exact redirect URI `https://<host>/auth/callback`, a post-logout redirect URI if D-08, the "Expose an API" scopes (D-16, if D-14), the app role (D-04), "Assignment required? = Yes", admin consent granted, and the permitted group assigned to the role. Register the redirect URI as platform **Web** (confidential), *not* **SPA**.

## 9. Files and seams

Verified against the tree at commit `373d5bd`. *new* = does not exist yet.

> **Tree note (#11).** The paths below are historical. After the provider-isolation refactor, provider-neutral backend files live under `backend/src/core/` (`core/config.ts`, `core/auth/{oidc,session,guard,bearer}.ts`, `core/db.ts`, `core/routes/{session,v1}.ts`, `core/audit.ts`), the frontend seams live under `frontend/src/core/` (`core/mocks/api.ts`, `core/mocks/data.ts`, `core/api/client.ts`, `core/screens/*`, `core/app/AppProvider.tsx`), and each provider's own code lives in `backend/src/providers/<id>/` and `frontend/src/providers/<id>/`, composed by the single registry in each package. `shared/` stays at the repository root.

**Backend — all new** (suggested location `backend/`; confirm in planning):

- `backend/package.json`, `tsconfig.json` — *new*
- `backend/src/config.ts` — *new*. Reads and validates env (tenant ID, client ID, credential, session secret, encryption key, base URL); fails fast if anything is missing.
- `backend/src/auth/oidc.ts` — *new*. Discovery, login redirect, callback, refresh, logout. Validates `tid` and the role.
- `backend/src/auth/session.ts` — *new*. Session plugin wiring, timeouts, regeneration.
- `backend/src/auth/guard.ts` — *new*. Global guard plus the public allow-list.
- `backend/src/auth/bearer.ts` — *new*, only if D-14.
- `backend/src/users/` — *new*. JIT upsert keyed on (`tid`, `oid`).
- `backend/src/routes/session.ts` — *new*. `GET /api/session` (metadata), `POST /api/session/refresh`, `POST /api/session/tokens/reveal`.
- `backend/src/routes/v1.ts` — *new*. `GET /v1/me`, `GET /v1/projects` (stub body from design-decisions).
- `backend/src/audit.ts` — *new*.
- `backend/test/` — *new*. Negative tests from §5, using a local test issuer/JWKS. No calls to real Entra in CI.
- `.github/workflows/backend-checks.yml` — *new*. Lint, typecheck, test and secret scan.

**Frontend — existing seams:**

- `frontend/src/mocks/api.ts` — the seam. Add `frontend/src/api/client.ts` (*new*) exporting the same function names, backed by `fetch` to the BFF with `credentials: 'same-origin'` and the CSRF header. Choose real vs mock by environment, and keep the mocks for component tests (Invariant 5).
- `frontend/src/screens/HomeSignIn.tsx`:
  - The Entra button becomes a **top-level navigation** to `/auth/login`, not a `fetch`.
  - Hide the Okta and Google buttons, the SSO email form and the divider (A19).
  - Show a callback error (from a query flag such as `?error=signin`) using the existing `Notice` error tone.
- `frontend/src/mocks/data.ts` — `PROVIDERS` stays for mocks. The real client exposes only Entra.
- `frontend/src/screens/Overview.tsx`, `components/TokenCard.tsx`, `components/TokenValue.tsx`:
  - Metadata comes from `GET /api/session`.
  - Reveal calls `POST /api/session/tokens/reveal`.
  - Replace the "DEMO VALUE" labels (D-15).
- `frontend/src/screens/ProfileAPI.tsx`, `ProjectsAPI.tsx` — `runRequest`/`refreshToken` go to the BFF; handle the expired-token seed per D-15.
- `frontend/src/screens/AccountIdentity.tsx` — hide the "Connect" actions and the non-Entra rows (A19). It lists only the Entra identity.
- `frontend/src/app/AppProvider.tsx` — on load, call `GET /api/session` to pick the initial screen (Overview if signed in, Sign in if not). `signOut` posts to `/auth/logout`.
- `frontend/src/screens/ForgotPassword.tsx`, `ChangePassword.tsx` — keep as provider hand-offs. Point the Entra destination at Microsoft's real self-service password reset / account pages, and look up the current URLs at implementation time. Hide the non-Entra provider options.
- `frontend/vite.config.ts` — add a dev proxy for `/auth`, `/api` and `/v1` to the BFF, so dev is also same origin.

## 10. Risks and rollback

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Owner-accepted (D-10): real refresh and access tokens are revealed in the browser.** Any XSS, malicious extension, screen share or shoulder-surf exposes them. Entra refresh tokens issued to a web (confidential) client last **90 days** by default and rotate on use, but Entra **does not revoke the old one** ([Refresh tokens](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens)). | Mitigating facts: a confidential-client refresh token cannot be redeemed without the client credential, which never leaves the server. The access token is short-lived. Its scopes are read-only. Required compensating controls: reveal only via an explicit `POST` with CSRF, `no-store`, rate-limited, audit-logged (A12); strict CSP with no inline/third-party script (A16); values dropped from memory on Hide and navigation; never logged. **Recommend revisiting before go-live:** reveal the access token only, or show refresh-token metadata only. |
| R2 | Global Administrators bypass app assignment. | Server-side app-role check (D-04, A4). |
| R3 | Client secret/certificate expiry silently breaks sign-in. | Prefer a certificate; calendar and monitoring alert ≥ 30 days before expiry; rotation runbook. |
| R4 | Deprovisioned employee keeps access up to 8 h. | Accepted via D-02/D-03. SCIM is deferred. |
| R5 | Entra outage = no access (no break-glass). | Accepted via D-09. |
| R6 | Mock and real code paths diverge. | The real client implements the same interface; one end-to-end smoke test against a dev tenant before each release (*manual*). |

**Rollback / kill switch:**

- The frontend reads a build-time flag, `VITE_AUTH_MODE=mock|entra`. The BFF reads `AUTH_ENABLED`.
- Rolling back = redeploy the previous build, or set the flag back to `mock` for a demo deployment.
- Because there are no pre-existing real users, rollback cannot lock anyone out of data that previously worked.
- To disable sign-in in an emergency **without** a deploy, the tenant admin sets the enterprise app's "Enabled for users to sign-in?" to **No** in Entra. That stops new tokens immediately. Then invalidate all sessions by rotating `SESSION_SECRET` / truncating the session table.

## 11. Phased order of work

Each phase is independently verifiable and merges behind PR review.

1. **BFF skeleton.** Fastify app, config validation, security headers, static serving of the SPA build, health route, global auth guard with route-inventory test, CI workflow, secret scan. *Verify:* A10 (unauthenticated 401s), A15–A17.
2. **Entra OIDC login and session.** Discovery, login, callback, ID-token validation, `tid` and role checks, JIT user upsert, session store, timeouts, logout, CSRF, rate limits, audit events. *Requires D-05, D-07, D-08, D-12, D-13, D-17 resolved and the Entra registration done.* *Verify:* A1–A9, A14, A18, A20.
3. **Session API and `/v1`.** `GET /api/session`, refresh, reveal (with R1 controls), `/v1/me`, `/v1/projects`, bearer validation if D-14. *Verify:* A11–A13.
4. **Frontend wiring.** Real API client behind the existing seam, Entra-only sign-in, hidden deferred UI, session bootstrap, sign-out, D-15 label changes, Vite dev proxy. Existing component tests keep using mocks. *Verify:* A19, frontend checks green, manual end-to-end against the dev tenant.
5. **Go-live review.** Re-confirm D-10 (R1) with the owner. Check certificate expiry alerting is in place. Check the audit retention job runs. Run a security review of the full diff.

## 12. Out of scope — do not add

- Okta, Google Workspace, generic OIDC/SAML or multi-tenant SSO
- Account linking / "Connect"
- SCIM
- Local passwords, password reset/change endpoints, email verification, app-level MFA, passkeys, social login
- Roles or permissions beyond "assigned users may use the app"
- Calls to Microsoft Graph (no group lookup is needed, because app roles are used)
- Mobile or responsive layouts
- Any change to the approved visual design beyond the hide/label changes listed above

## References (checked 2026-10-14)

- Microsoft — ID token claims reference (`oid`/`sub`/`tid`, `email`/`preferred_username` mutable, groups overage at 200): https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference
- Microsoft — Refresh tokens (24 h SPA / 90 days other; rotation; old tokens not revoked): https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens
- Microsoft — Restrict an app to a set of users (Assignment required; Global Admin bypass; admin consent): https://learn.microsoft.com/en-us/entra/identity-platform/howto-restrict-your-app-to-a-set-of-users
- OWASP — Session Management Cheat Sheet (≥ 64-bit entropy, `__Host-`, `SameSite`, server-side idle/absolute timeouts, regenerate on login): https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- panva/openid-client v6: https://github.com/panva/openid-client
- Skill reference: `.claude/skills/add-authentication/references/sso.md`
