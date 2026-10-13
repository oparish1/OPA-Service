---
name: containerize-application
description: Containerizes an application — agent, API, frontend, or full stack — into production-ready Docker artifacts (Dockerfile, .dockerignore, docker-compose.yml and an optional Caddy reverse-proxy compose file) and reviews or hardens existing ones. Reads the codebase first to find the real entry point, port, dependencies and runtime, then asks about anything the code does not settle. Use whenever the user asks to dockerize, containerize, add Docker to, create a Dockerfile for, set up docker-compose for, put a reverse proxy or HTTPS in front of, or deploy a project in a container, or mentions moving from a dev container or local dev to production — and whenever they ask to review, harden, slim down, or fix an existing Dockerfile or compose file (non-root user, minimal base image, health checks, layer caching, secrets).
metadata:
  arguments: "[project-path]"
---

# Containerize Application

## Objective

A container that builds is not a container that is fit to run in production. The usual failures are quiet: the process runs as root, a `.env` is baked into a layer, the app listens on `127.0.0.1` and is unreachable, `npm start` swallows SIGTERM so deploys hang, or a health check passes while the app is broken. This skill reads the project to learn what it actually is, asks about what the code cannot tell it, writes the artifacts and then proves they work.

**Governing rule: every entry point, port, environment variable, runtime version and volume path comes from the code or from the owner — never from what is conventional for the framework.** If the code does not settle it, ask; do not write a plausible default into the Dockerfile. Prefer asking one specific question over guessing and say what you found when you ask.

## Arguments

`containerize-application [project-path]`. Default to the current project root. Write artifacts next to the code they build (repository root, or the service's directory in a monorepo) unless the user names another location; confirm the location before writing if there is more than one candidate.

## Process

### Step 0: Understand the project (read before writing anything)

Invoke the **prime-codebase** skill if available; otherwise read the project yourself. Establish, from the files:

- **Kind:** agent (long-running worker, loop, or queue consumer, possibly with tool use), API/server, frontend (static or server-rendered), or full stack. A repository can hold several deployables; list them.
- **Language, runtime version, package manager and lockfile.** Read version pins (`.nvmrc`, `engines`, `.python-version`, `pyproject`, `go.mod`) rather than assuming.
- **Entry point and start command** as the project itself defines them (scripts, `Procfile`, framework config). Never invent one.
- **Port(s) and bind address.** Find where the app listens and whether it binds `localhost` (unreachable from outside a container) or all interfaces. Note any port read from an environment variable.
- **Build steps:** compile, bundle, migrations, asset generation; what must exist at build time versus run time.
- **Configuration and secrets:** every environment variable the code reads, which are secrets and which have safe defaults.
- **External services:** database, cache, queue, object storage, other APIs. Decide whether they belong in compose or are managed elsewhere.
- **State:** paths the app writes to (uploads, SQLite files, caches, logs, agent memory). These become volumes or tmpfs.
- **Existing Docker setup:** `Dockerfile`, compose files, `.dockerignore`, `.devcontainer/`, CI build steps. Extend or replace deliberately; a dev container is not a production image, so do not reuse its image, tooling, or user.
- **Health signal:** an existing health endpoint, or the lack of one.

Summarize the findings back to the user in a few lines before continuing. Flag anything ambiguous.

### Step 1: Ask what the code does not settle

Ask rather than assume; use a chat-native elicitation tool if available. Ask only what Step 0 left open and lead with what you found. Typical questions:

1. Which deployable(s) to containerize, if the repository holds several.
2. Where it will run: a single host with Compose, or an orchestrator (Kubernetes, ECS, Cloud Run and similar). This changes health checks, logging and whether compose is the deliverable at all.
3. Whether it should sit behind a reverse proxy with automatic HTTPS (Caddy), the domain name and whether DNS and ports 80/443 are available.
4. How secrets reach the container in production (env file on the host, orchestrator secrets, a secrets manager).
5. Which services compose should run alongside it and which data must survive a restart.
6. Any hard constraints: image size, registry, base-image policy, CPU architecture (amd64, arm64, or both).

If the user says "you decide", decide, state the choice and the reason in the summary and mark it easy to change.

### Step 2: Write the Dockerfile and .dockerignore

Read the reference for the stack and `references/agent.md` when the project is an agent or runs model-driven tools:

- Node/TypeScript (including Next.js and Vite builds): `references/node.md`
- Python: `references/python.md`
- Go: `references/go.md`
- Static or SPA frontend served from a web server: `references/static-frontend.md`
- Agents, workers and anything that executes model-chosen actions: `references/agent.md`

Non-negotiable baseline for every image; each item needs a reason in your summary:

- **Multi-stage build:** compile and install build tools in a builder stage; the final stage carries only what runs.
- **Minimal, pinned base image.** Look up the current supported versions and pin an explicit version tag (a digest if the user wants reproducibility). Never `latest`. Do not write version numbers from memory.
- **Layer-cache ordering:** copy dependency manifests and lockfile, install, then copy source. Use the lockfile for reproducible installs.
- **Non-root user** in the final stage, with files owned by it and writable paths limited to declared state directories.
- **Correct signal handling:** the app is PID 1 or runs under a minimal init; use the exec form of `CMD`/`ENTRYPOINT` so SIGTERM reaches it; do not launch through a package-manager script.
- **Listens on all interfaces** on the port the code uses, with the port declared by `EXPOSE`.
- **Health check** that tests the app, not the process, using only tools present in the final image. If the image has no shell or curl, use a built-in check subcommand or a runtime one-liner.
- **No secrets in the image:** none in `ENV`, `ARG`, `COPY`, or layers. Build-time credentials use BuildKit secret mounts.
- **`.dockerignore`** excludes VCS data, dependencies, build output, `.env*`, credentials, local databases, editor and OS files and the Docker files themselves. Prefer an allow-list when the tree is messy.
- **OCI labels** for source and version where cheap.

### Step 3: Write docker-compose.yml and Caddy if asked

Read `references/compose-and-caddy.md`. Generate compose for the agreed services with health checks, restart policy, named volumes, resource limits, an env-file or secret mechanism and dependency ordering by health. If a reverse proxy was chosen, also write the Caddy compose file and Caddyfile and make sure only the proxy publishes ports. If the target is an orchestrator, say that compose is for local and single-host use and give the equivalent settings instead of pretending compose is the deployment format.

### Step 4: Verify

Verify before saying it works.

1. If a Docker CLI is available: build the image, run it, confirm the health check turns healthy, confirm `docker inspect` shows a non-root user, request the app's port from the host, stop it and confirm it exits promptly on SIGTERM and record the image size. Use `docker compose config` to validate compose files.
2. If Docker is not available, say so plainly. Do static checks only (lint with `hadolint` if present, validate YAML, re-read every path, port and user against the code) and list exactly what remains unverified so the user can run it.
3. If a scanner such as Trivy or Docker Scout is available, run it and report findings without hiding them.

Report what you verified and what you did not. Never claim a build passed that you did not run.

### Step 5: Deliver

Save the artifacts to the agreed location. Summarize in a short list: files written, the base image and why, decisions you made and where you asked, how to build and run and what is left for the owner (secrets to provide, DNS to configure, resource limits to tune against real load). Do not commit or push unless asked.

## Review mode (existing Dockerfile or compose file)

When asked to review or harden existing artifacts:

1. Read them against the code (Step 0) first; a Dockerfile can be well-formed and wrong for the project.
2. Read `references/review-checklist.md` and produce findings grouped by severity, each with the line, why it matters and the fix.
3. Report before changing. Apply fixes only after the user agrees, or when they asked you to harden directly; keep behavior the same unless a finding says otherwise and verify as in Step 4.

## Do not

- Do not guess entry points, ports, environment variables, or versions.
- Do not run as root in the final image, mount `/var/run/docker.sock`, or use `--privileged` unless the owner has a reason you have written down.
- Do not put `.env` files, keys, or tokens in the image, compose file, or repository.
- Do not use `latest`, or version tags copied from memory.
- Do not reuse a dev container as the production image.
- Do not publish database or cache ports to the host unless the user needs them.
