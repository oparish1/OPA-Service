# Review and Hardening Checklist

Use this when the user asks to review, harden, slim, or fix an existing Dockerfile or compose file. Read the artifacts against the project's code first (entry point, port, bind address, env, state paths); then walk this list. Report findings grouped by severity with the line, the reason and the fix and change nothing until the user agrees (unless they asked you to harden directly).

## Contents
1. Critical
2. High
3. Medium
4. Low
5. Compose-specific
6. Reporting format

## 1. Critical (fix before running in production)

- Secrets, tokens, keys, or `.env` copied into the image or set through `ENV`/`ARG` (check `docker history` for build args).
- Runs as root in the final stage.
- Docker socket mounted, `privileged: true`, host network or PID namespace, or host paths such as `/` or the home directory mounted, without a written justification.
- Database, cache, or admin ports published on all interfaces.
- App binds `127.0.0.1` inside the container, so the published port cannot reach it.
- Image built from an unpinned or `latest` base, or from an untrusted source.

## 2. High

- Single-stage build carrying compilers, package managers, tests and source into the final image.
- `CMD` through a shell or package-manager script (`npm start`, `sh -c`), so SIGTERM never reaches the app; no init when the app spawns children.
- No health check, or a health check that only tests that a process exists, or that calls a tool absent from the image (`curl` in a distroless image).
- Development server, debug mode, or reloader in the production command.
- Dependencies installed without the lockfile (`npm install`, unpinned `requirements.txt`), so builds are not reproducible.
- Missing `.dockerignore`, so `.git`, `node_modules`, `.env` and local databases enter the build context.
- No restart policy, or a restart loop masking a failing service.
- State written into the container filesystem with no volume, so data disappears on recreate.

## 3. Medium

- Poor layer ordering: source copied before dependency install, busting the cache on every edit.
- Package manager caches and apt lists left in layers; missing `--no-install-recommends` and list cleanup.
- Alpine used with musl-sensitive dependencies (native Node modules, Python wheels), or Debian used where a smaller static image would do.
- No resource limits (memory, CPU, pids) or log rotation.
- Capabilities not dropped; no `no-new-privileges`; root filesystem writable when it need not be.
- `depends_on` without health conditions, so the app starts before its database is ready.
- Health check timing that flaps (start period shorter than startup) or is too slow to detect failure.
- `ADD` where `COPY` is meant; remote `ADD` without checksum; `curl | sh` installs.
- Missing `WORKDIR`, relative paths, or files owned by root in a non-root image.

## 4. Low

- No OCI labels; no version or build metadata.
- Large image that a slimmer base or distroless final stage would shrink.
- Time zone, locale, or `ulimit` settings the app does not need.
- Obsolete top-level `version:` key in compose files.
- Duplicate or dead instructions; comments that no longer match the code.
- Multi-arch not considered when the deployment targets a different CPU architecture than the build machine.

## 5. Compose-specific

- Bind mounts of the source tree in the production file.
- Credentials inline in `environment:`; database defaults left in place.
- Missing named volumes for data services; anonymous volumes accumulating.
- Proxy in front but the app also publishes a port, bypassing it.
- No separation between development overrides and production settings.
- Caddy state (`caddy_data`) not persisted, risking certificate re-issuance limits.

## 6. Reporting format

For each finding: severity, location (`Dockerfile:14`), what is wrong, why it matters in one sentence and the exact fix. Then a short summary: what is already good (so the user keeps it), the top three fixes by impact, any behavior change a fix would cause and what you could not verify. After the user agrees, apply the fixes and verify as in SKILL.md Step 4, reporting the before/after image size and what the checks showed.
