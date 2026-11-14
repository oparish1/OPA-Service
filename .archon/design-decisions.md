# Approved design decisions (binding for figma-ground and implementation)

These answer open questions. Treat each as resolved. Do not re-ask.

## Local-implementation components (counted as mapped)
These are built in the frontend from design tokens only, not added to the Figma design system. List them in component_mapping as "Local: <name>", not in unmapped_elements.
- **Notice:** tone = neutral | success | error. Icons: shield-check (neutral), circle-check (success), circle-alert (error). The Screen 7 token recovery banner is Notice tone=error containing AA/RecoveryResponse and its action buttons.
- **PublicFooter:** local frame as drawn. "Privacy" and "Terms" are AA/TextLink with href="#".
- **StepIndicator:** local frame as drawn. Steps are separated by a middle dot "·" in Body/13 grey.
- **Endpoint URL field:** editable custom element, 44px height, 1px border, IBM Plex Mono 14, tokens only. Not AA/Form/Input; it keeps the local token styling and shows the Input error treatment.
- **CodeBlock:** wrapper for the code-surface style (IBM Plex Mono 14/22 on #F8F7F8). Used inside AA/ResponseCard and AA/TokenCard. Not used standalone at page level.

## States and behavior
- **API screens before "Run request":** show the ResponseCard shell with placeholder text "Run the request to see the response" (Body/14 grey). No auto-populated response.
- **Projects success body (after token refresh):** `{ "projects": [ { "id": "prj_01", "name": "Atlas", "status": "active" }, { "id": "prj_02", "name": "Beacon", "status": "active" }, { "id": "prj_03", "name": "Cedar", "status": "archived" } ] }`
- **Workspace selector:** the "Agentic Advantage" label and chevron are fully inert (no menu).
- **Help links ("Need help?", "Can't access your provider?"):** AA/TextLink with href="#" and no navigation.
- **Screen 1 height:** keep 1080px as drawn (viewport-filling split layout).
- **Profile API token-expired state:** reuse the Projects API 401 recovery treatment.
- **Copy:** icon swaps to check and label reads "Copied" for 2 seconds.
- **Token reveal:** toggles Reveal ⇄ Hide; resets to masked on session refresh and on leaving Overview.
- **Sign out:** navigates to Sign in and clears mock session state.
- **Headers tab:** “Headers (n)” rendered from the relay’s filtered response headers; shows “No response headers.” when the relay returned none.
- **Icons:** all Lucide React.

## Round 3 decisions (approved)

- **Organisation SSO row (ProviderRow):** AA/ProviderRow is a generic, props-driven component (icon, name, subtitle, badge tone and label, action label). All four rows are instances of it. The Microsoft, Okta and Google "Loaded" variants are presets; Organisation SSO is a fourth preset with a generic building-2 icon, subtitle "Organisation single sign-on", badge Tone=Neutral "Not connected" and a Connect button. No new Figma variant is needed.
- **"JSON · Pretty" label (ResponseCard):** static, non-interactive text. No Pretty/Raw toggle.
- **Select and Recovery select validation:** when submitted with no provider chosen, the field enters its Error state with the message "Choose an identity provider to continue." (Body/13, same Error styling as the email input).
- **"Documentation" sidebar link:** AA/TextLink with href="#", no navigation.
- **RequestPanel:** extract one shared RequestPanel component (HttpMethodBadge + editable endpoint URL field + TokenSelect + Run request button + View session link). Screen 6 uses it inline and AA/RecoveryResponse on Screen 7 renders the same component.

## Round 4 decisions (approved)

- **Editable request URL:** the Endpoint URL field is editable on both API screens; the method stays GET. The URL is held in memory per screen and resets when the user leaves the screen. An invalid URL shows "Enter a valid http or https URL." and sends nothing.
- **Authorization options:** the dropdown lists exactly four options in this order — the session access token (masked, default), `Bearer valid-token-123`, `Bearer expired-token`, `no-token`. A 401 on the session option shows the recovery panel; a 401 on any other option is shown normally.
- **Live requests are relayed:** the browser never calls the target URL directly. `POST /api/request-runner` requires the session, CSRF and Origin checks, rate limiting and an audit event, and returns the response status, filtered headers, body, size, duration and backend receipt time. The session token is attached server-side and only to the app's own origin.
- **Relay safety rules:** http/https only, at most 2048 characters, no URL credentials, GET only; host allowlist from the public origin plus `REQUEST_RUNNER_ALLOWED_HOSTS`; redirects not followed; 10-second timeout; 1 MiB body cap with truncation flagged; response headers limited to an allowlist and `set-cookie` never returned; the session token is refused for any host that is not the app's own origin; query strings and tokens are never logged.
- **Demo footer removed:** the "No live request was made" / "No live API request or token refresh was performed" disclaimers are gone; the Response card now reflects the real relayed response.
- **Local setup:** `PUBLIC_BASE_URL` must be the frontend origin (not the backend port) and the dev server proxies `/v1/*` and `/api/request-runner`, or every default-URL run fails `session_token_not_allowed_for_host`.

## Standing rules for anything else not drawn
These are approved defaults. Use them instead of adding an open question and list each one used under "Assumptions" in the design brief:
- Network or unexpected failure on any action: Notice tone=error with "Something went wrong. Try again." and a Retry button.
- Mock latency: 400 to 1500 ms per request.
- Keyboard: tab order follows visual order; Enter submits forms; Escape closes open listboxes and returns focus to the trigger.
- Document titles: "<Screen name> · Your Identity".
- Layout: desktop only (1280px and up); no mobile or tablet.
- Any other undrawn state: use the nearest existing component variant and its tokens.
EOF
## Round 5 decisions (Okta and Google sign-in, approved)

- **Provider-driven sign-in:** the sign-in screen renders one `AA/Authentication/Provider` row per provider returned by `GET /auth/providers`, in the order Entra, Okta, Google. Provider icons stay a frontend concern; the BFF contract carries ids, display names and public account destinations only.
- **Provider-neutral notice copy:** the sign-in notice body is "Your organisation's identity provider manages sign-in, recovery and password changes." (was Entra-specific).
- **Account & identity:** the screen lists only the current session's identity with its `Primary` badge. A `Manage` action appears only when that provider has a configured `_MANAGE_ACCOUNT_URL`; there is no `Connect` action.
- **Forgot / Change password:** the provider list is the enabled provider list from `GET /auth/providers`. The action is disabled when the selected provider has no configured destination; no destination is hard-coded.
- **Overview:** when the session has no refresh token, the Refresh control is disabled ("Refresh not available for this session") and a "Sign in again" link is offered instead; the refresh card badge reads `Not issued`.

## Browser-only direction (issue #12, supersedes the BFF decisions)

This issue is the maintainer's explicit decision to replace the
backend-for-frontend direction. These decisions are **binding** and supersede
anything above that conflicts:

- **SD-1** The gateway serves the `/v1` demo endpoints itself from golden
  fixtures; no separate service.
- **SD-2** Okta uses `@okta/okta-auth-js`, Entra uses `@azure/msal-browser`,
  Google uses the Google Identity Services script. No hand-written OAuth, PKCE
  or JWT code.
- **SD-3** Tokens are held in memory only; never `localStorage`, cookies or
  IndexedDB. A library with no in-memory option may use `sessionStorage` for
  that library only, with the risk recorded in the README.
- **SD-4** Entra and Okta use their library's silent renewal; Google has no
  renewal and shows the "Sign in again" treatment.
- **SD-5** Sign-out is local only for all three providers.
- **SD-6** The gateway writes structured JSON access logs; existing backend
  audit data is development data and is discarded.
- **SD-7** Apache APISIX in declarative standalone mode under `gateway/`, run
  with Docker Compose, pinned to an exact released 3.x image tag.
- **SD-8** Entra uses a new Single-page-application registration.
- **SD-9** 30-minute idle and 8-hour absolute limits are enforced in the
  browser as a courtesy; the security bound is the token lifetime at the
  gateway.
- **SD-10** Google users call read endpoints only (GET) through
  `/google/v1/*`, authenticated by a validated Google ID token; any other
  method returns 403. The in-process relay is deleted.
- **SD-11** The gateway holds no identity-provider secret. Route files
  reference placeholder environment-variable names only.

Superseded by this direction: O-05, O-08, O-09, O-10, O-15, the server-side
request runner and its safety rules, Invariant 5's server-side session rules,
and "Entra frontend and backend must remain untouched".

The Round 5 "Provider-driven sign-in" decision's `GET /auth/providers` source is
superseded by the static public configuration file; the provider-row ordering
Entra, Okta, Google and the provider-neutral notice copy remain binding. The
Round 3/4 UI decisions remain binding.

## Advisory UI authorization (issues #21, #3)

- **The gateway stays the only security authority.** The browser fetches
  `GET /{provider}/authz/capabilities` to decide what to show or enable. The
  gateway builds the OPA input from the token it has already verified and
  returns `authz.v1.capabilities`; a browser decision is advisory and can never
  grant what the gateway refuses.
- **One shared policy source, one evaluator.** `authz-service/authz/` holds the
  claim rules in Rego v1; the gateway wrappers in
  `authz-service/authz/v1/gateway/` import it for enforcement and answer the
  capabilities route. Issue #3 Capabilities may be evaluated in the browser from the published WASM (authz-policy release) as advisory UI hints only. The gateway is the sole enforcer. Gateway mode is the default; WASM mode is opt-in via authz.mode.
- **Fail closed.** If the capability call fails or returns an incomplete map,
  the UI keeps a baseline capability floor (Overview and Account) and enables
  nothing else.
- **No environment value in Rego.** Tenant and domain values arrive as
  data (`data.authz.config`), supplied from the gateway route labels. The
  browser public config carries them only for the provider libraries.
- **Rollback.** `authz.enabled` (default true) turns the capability call off and
  restores pre-change behavior; the gateway is unaffected.

## Logging and configuration failures (issue #16)

- **One logger.** `frontend/src/core/lib/log.ts` is the only logger. Callers pass
  their own scope; provider modules pass their provider id. It names no provider.
- **Safe by construction.** Entries are scrubbed before they reach the console or
  the in-memory buffer: sensitive keys, JWT-shaped strings, PEM blocks and
  `code`/`state`/token query parameters become `[redacted]`; strings are capped
  at 300 characters and arrays at 20 items.
- **Levels and buffer.** `logLevel` is an optional public config field
  (`debug`, `info`, `warn`, `error`), defaulting to `debug` in development and
  `warn` in production. The last 200 entries stay in memory only; `window.__logs`
  exists in development builds only.
- **No silent failures.** Every non-test `catch` or `.catch()` in `frontend/src`
  logs, rethrows, or carries `// log-exempt: <reason>`. `scripts/check-catch-handling.ts`
  enforces the rule in CI and in `bun run check`.
- **Visible reference.** Every user-visible failure notice shows
  `Reference: <6 hex>` inside the existing `Notice`; the same value is in the log
  entry. No new component or colour is introduced.
- **Configuration failures.** A missing, non-200, non-JSON, invalid or
  secret-shaped `config.json` shows the configuration error screen with its
  reason class and reference. It never starts the mock demo. The mock demo is
  opt-in with `?mock=1` in a development build.
- **Startup failures.** A throw after config loads shows a generic startup
  notice with a reference; it does not point the operator at `config.json`.

## Catalogue-driven policy (issue #24)

- **Capabilities, roles and routes are data.** `authz-service/authz/` keeps the Rego
  engine; the capability catalogue, the flattened role hierarchy, the
  claim-to-role map and the route table live in
  `authz-service/authz/{catalogue,roles,role_map,routes}.json`. Adding a capability or
  a role is a data edit with no Rego change.
- **Provider files hold provider logic only.** Each `authz-service/authz/providers/`
  file exposes the roles it grants (through the shared map), its gate failures
  and whether scopes apply. It names no capability and no role. The neutral
  engine builds the per-capability deny set once for all providers.
- **One new reason code.** `insufficient_role` is reported only after the
  provider's base gate passes, so existing deny sets and audit reasons are
  unchanged; `missing_admin` does not exist.
- **One shared source, one evaluator plus generated types.** The gateway is the
  only evaluator: it imports the package for enforcement and answers the
  capabilities route. `frontend/src/core/authz/generated.ts` and
  `authz-service/fixtures/matrix.snapshot.json` are generated from the policy and
  checked for freshness in CI, so the browser's capability/reason types cannot
  drift from the gateway rules.
- **No environment value in the policy.** Entra's tenant and Google's hosted
  domain remain `data.authz.config`, supplied from route labels; the static
  tables carry neither.

## Gateway internal transport (issue #7)

- **Container-to-container traffic in the gateway Compose stack is plaintext
  HTTP.** APISIX calls OPA at `http://opa:8181` and the test issuers at
  `http://<name>:80xx`, and the test issuers advertise `http://` origins. The
  Compose network is private and no service in the stack terminates TLS.
- **TLS is a browser-edge concern.** HTTPS is terminated in front of APISIX in
  production; the local browser-to-APISIX edge is out of this decision.
- **No certificate material or TLS flag is added** to OPA or the test issuers
  (SD-11). The Docker-free config gate asserts that the APISIX `opa` plugin
  scheme matches the OPA command's TLS flags and that every test-issuer URL in
  the Compose stack is plaintext.
