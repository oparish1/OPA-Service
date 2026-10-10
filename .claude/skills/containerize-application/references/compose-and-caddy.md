# docker-compose.yml and the Caddy Reverse Proxy

Compose describes how the containers run together on one host. It is the deliverable for local, staging, and single-host production. If the target is an orchestrator (Kubernetes, ECS, Cloud Run), compose is for local use only; translate the same settings (health probes, resource limits, secrets, volumes) to that platform's format, and say so.

## Contents
1. Compose file rules
2. Service settings that matter
3. Dependencies and data services
4. Secrets and configuration
5. Adding Caddy
6. Caddyfile
7. Verify

## 1. Compose file rules

- Use the Compose Specification. Omit the obsolete top-level `version:` key.
- One service per process. Give every service a health check, a restart policy, and a pinned image or a `build:` with an explicit tag.
- Do not publish a port unless something outside the compose network needs it. Use `expose` for container-to-container traffic. When a reverse proxy is in front, only the proxy publishes ports.
- If a port is published for local use, bind to loopback (`127.0.0.1:8080:8080`) unless the owner wants it reachable from other machines.
- Named volumes for state; never bind-mount the source tree in a production file. A separate override file (`docker-compose.override.yml` or a `dev` profile) may add source mounts and debug settings for development.

## 2. Service settings that matter

For the application service:
- `build` with `context` and `dockerfile`, and `image` with a tag, so the built image is nameable.
- `init: true` when the app is not its own reliable PID 1.
- `restart: unless-stopped` for long-running services.
- `healthcheck` mirroring the Dockerfile's (interval, timeout, retries, start period).
- `read_only: true` with `tmpfs` for `/tmp` and named volumes only for declared state paths, when the app tolerates it (verify by running it).
- `cap_drop: [ALL]` and `security_opt: [no-new-privileges:true]`, adding capabilities back only when a specific need is proven.
- `user` only if the image does not already set a non-root user.
- Resource limits: memory and CPU, plus `pids_limit`. Numbers come from the owner or from measurement; if unknown, put a clearly labelled starting value with a comment saying to tune it against real load.
- `stop_grace_period` matching how long the app needs to shut down gracefully.
- `logging` driver options with size-based rotation if the default driver is json-file, so logs cannot fill the disk.

## 3. Dependencies and data services

- Use `depends_on` with `condition: service_healthy` so the app waits for the database's health check rather than only its start.
- Database or cache images: pinned version, named volume for data, a health check appropriate to the engine, credentials from secrets or an env file, no published port unless required.
- Migrations: ask how they run (a one-shot service using the same image with a different command and `depends_on`, a release step, or manually). Do not run them implicitly on every replica start.
- Prefer a managed database for production data if the owner has one, and say compose's database is for development or small deployments.

## 4. Secrets and configuration

- Use `env_file` pointing to a file that is git-ignored, and commit `.env.example` with names and no values.
- Better for sensitive values: Compose `secrets:` (file-based) mounted at `/run/secrets/<name>`; the app must read them from the file, so check whether it supports `*_FILE` variables or needs a small code change.
- Do not inline secrets in the compose file or in `environment:` values that end up in `docker inspect` output when avoidable.
- Non-secret settings (port, log level) can live in `environment:` with defaults such as `${LOG_LEVEL:-info}`.

## 5. Adding Caddy

Ask first: the domain, whether DNS already points at the host, and whether ports 80 and 443 are reachable from the internet. Caddy obtains and renews certificates automatically when those hold.

Write a second file, for example `docker-compose.caddy.yml`, used together with the base file (`docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d`). It adds a `caddy` service:
- Pinned `caddy` image (look up the current version), `restart: unless-stopped`.
- `ports`: 80, 443, and `443/udp` (HTTP/3).
- Volumes: the Caddyfile mounted read-only; **`caddy_data` persisted** (it holds certificates and ACME account keys, so losing it risks rate limits and downtime) and `caddy_config`.
- Joined to the same network as the app, and `depends_on` the app's health.
- The app service must **not** publish its own port when the proxy is in use. Generate the base file to match the answer: publish for the no-proxy case, `expose` only for the proxy case. Do not rely on an override to remove a published port unless you have confirmed the Compose version supports resetting it.

For local testing, use a hostname such as `localhost`; Caddy issues a certificate from its own local CA, which the browser will not trust until that CA is installed. Say so rather than presenting it as a fault.

## 6. Caddyfile

Structure, adapted to the project:
- A site block for the domain with `reverse_proxy <service-name>:<port>` using the compose service name and the container port.
- `encode zstd gzip` for compression.
- Optional security headers appropriate to the app, agreed with the owner.
- For a static front end plus an API, route by path (`handle /api/*` to the API service, everything else to the front-end service).
- An email address for ACME expiry notices if the owner wants one, set in the global options.
- WebSockets and server-sent events work through `reverse_proxy` without extra configuration; for streaming responses (common with agents), check whether response buffering settings are needed and set flush behavior per Caddy's current documentation.
- Access logs to stdout.

Validate the file with Caddy's own validation command before delivering, if the binary or image is available.

## 7. Verify

- `docker compose config` renders without error (run with each `-f` combination).
- `docker compose up -d`, then every service reports healthy in `docker compose ps`.
- The app answers through the proxy over HTTPS; a request straight to the app's port from outside the compose network fails when only the proxy should be exposed.
- Stopping the stack exits within the grace period; volumes persist across `down` and `up`; `down -v` is understood to delete them.
- The Caddy certificate is issued (or, locally, the internal CA warning is explained).
- List what could not be tested (for example real DNS and ACME issuance) instead of implying it passed.
