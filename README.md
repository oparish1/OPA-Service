# Your Identity

A signed-in workspace for exercising protected APIs with a real Microsoft Entra
ID session. The frontend is a React + Vite SPA; the backend is a Bun + Fastify
BFF that owns the Entra authorization-code flow, stores tokens server-side, and
serves `/v1/me` and `/v1/projects`.

## Local setup

Install dependencies in each package with the committed lockfile:

```sh
cd frontend && bun install --frozen-lockfile
cd ../backend && bun install --frozen-lockfile
```

The backend reads its configuration from the environment. At minimum it needs
`ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, a client credential (`ENTRA_CLIENT_SECRET`
or `ENTRA_CLIENT_PRIVATE_KEY`), `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY`.
`DATABASE_URL` defaults to an in-memory SQLite store; production requires a
durable path.

Run the two dev servers:

```sh
cd backend && bun run dev      # PORT, default 3000
cd frontend && bun run dev     # Vite, default 5173, proxies /auth, /api and /v1
```

The frontend selects the real BFF client when `VITE_AUTH_MODE=entra`
(`frontend/.env.local`).

### Public base URL

`PUBLIC_BASE_URL` is the app's own public origin and must be the origin the
browser is using — for local development, the frontend origin, not the backend
port. It drives the default request URLs (`<origin>/v1/me` and
`<origin>/v1/projects`), the CSRF/Origin check, and the host the session token
is allowed to reach.

## Request runner

The API screens send one real `GET` through an authenticated backend relay,
`POST /api/request-runner`. The browser never calls the target URL directly and
never receives the session access token: the backend resolves the token from the
server-side store and attaches it only to the app's own origin.

The route accepts a closed `auth` enum and returns the response status, filtered
headers, body, byte size, backend-measured duration and backend receipt time.

### Allowed hosts

By default only the host of `PUBLIC_BASE_URL` may be requested. Administrators
may extend the allowlist with the comma-separated environment variable
`REQUEST_RUNNER_ALLOWED_HOSTS`. Entries are exact `host[:port]` values; wildcards
are not supported. The variable's values are deployment configuration and are
never committed to this repository.

### Safety rules

1. Only `http:` and `https:` URLs, at most 2048 characters, no username or
   password, and GET only.
2. Host allowlist: the `PUBLIC_BASE_URL` host plus `REQUEST_RUNNER_ALLOWED_HOSTS`.
   Any other host returns `blocked_host` and nothing is sent.
3. Redirects are not followed; a 3xx response is returned as is.
4. The session access token is attached only when the target origin equals the
   app's own public origin. For any other allowed host the session option returns
   `session_token_not_allowed_for_host`.
5. Only the Authorization header (per the selected option) and
   `Accept: application/json, text/plain;q=0.9, */*;q=0.1` are sent. Browser
   cookies, the session cookie, the CSRF token and other client headers are never
   forwarded.
6. A 10-second timeout applies and the response body is capped at 1 MiB
   (`truncated: true` when cut). Returned headers are limited to `content-type`,
   `content-length`, `date`, `cache-control`, `etag`, `www-authenticate`,
   `retry-after` and `x-request-id`; `set-cookie` is never returned.
7. Authorization values, the session token and URL query strings are never
   logged. Audit events record the actor, target host and path, the `auth` option
   name, status, duration and outcome.
8. The relay does not refresh tokens. An expired session token is sent as is, so
   a real 401 comes back and the existing recovery flow applies.
9. The documented local setup above must hold: `PUBLIC_BASE_URL` is the frontend
   origin and the dev server proxies the API routes, including `/v1/*` and
   `/api/request-runner`.

## Checks

Each package defines its own gates:

```sh
cd frontend && bun run lint && bun run typecheck && bun run test && bun run build
cd backend && bun run lint && bun run typecheck && bun test && bun run build
```
