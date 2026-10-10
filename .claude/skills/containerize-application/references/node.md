# Node.js / TypeScript

Covers plain Node servers and workers, and build-then-run frameworks (Next.js, Nest, Remix, Vite SSR). Static-only builds go to `static-frontend.md`.

## Contents
1. What to read in the project
2. Base image
3. Dockerfile pattern
4. Framework notes
5. Health check
6. Pitfalls

## 1. What to read in the project

- Lockfile decides the package manager: `package-lock.json` (npm), `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`. Use the matching install-from-lockfile command (`npm ci`, `yarn install --frozen-lockfile`, `pnpm install --frozen-lockfile`).
- Runtime version from `.nvmrc`, `.node-version`, `engines`, or `volta`. If none, ask; do not assume.
- `scripts.build` and `scripts.start`, plus what `start` actually runs (`node dist/server.js`). You will run that `node` command directly.
- The port variable (`process.env.PORT`) and the bind address in the listen call.
- Native modules (`node-gyp`, `sharp`, `bcrypt`, `better-sqlite3`) — these decide the base image.
- Monorepo/workspaces: which package is the deployable; build context must include workspace roots the package depends on.

## 2. Base image

- Look up the current Active/Maintenance LTS and pin an explicit version tag for the final stage. Prefer a `-slim` (Debian) variant. Use an Alpine variant only when no dependency ships glibc-only binaries; Alpine uses musl and can break native modules.
- The official Node images include a non-root `node` user; use it rather than creating one.
- Distroless Node is an option for the final stage when the owner wants minimal attack surface; note it has no shell, so the health check must be a Node one-liner.

## 3. Dockerfile pattern

Stages: `deps` (install all dependencies from the lockfile), `build` (copy source, run build), `prod-deps` (install production dependencies only), `runtime` (copy `prod-deps` node_modules and built output).

Points that matter:
- Copy `package.json` and the lockfile alone first, install, then copy the rest. Use a BuildKit cache mount for the package-manager cache.
- Set `NODE_ENV=production` in the runtime stage; installing devDependencies is a build-stage concern only.
- `COPY --chown=node:node` the runtime files; set `USER node`; `WORKDIR` owned by that user.
- `CMD ["node", "dist/server.js"]` (use the project's real command). **Never `CMD ["npm","start"]`**: npm does not forward SIGTERM, so shutdown stalls until the orchestrator kills the container. Use Compose `init: true`, `docker run --init`, or a small init such as tini as PID 1 if the app spawns children.
- The app must handle SIGTERM (close server, finish in-flight requests, exit). Verify it does; add it only if the owner agrees to a code change.
- Declare `EXPOSE` to match the port the code reads; document that `PORT` can override.

## 4. Framework notes

- **Next.js:** if `output: 'standalone'` is configured (or the owner agrees to enable it), copy `.next/standalone`, `.next/static`, and `public` into the runtime stage and run the generated `server.js`; this shrinks the image greatly. Set `HOSTNAME` so it binds to all interfaces. Variables prefixed `NEXT_PUBLIC_` are inlined into the client bundle at build time: they are public and must be passed as build args, never secrets.
- **Vite/CRA/SPA builds:** build in a stage and serve with a web server (`static-frontend.md`). Build-time env vars are baked into the JS and visible to every user.
- **NestJS / Express / Fastify:** compile TypeScript in `build`, run compiled JS from `dist`. Confirm the server listens on `0.0.0.0` (Fastify defaults to localhost).
- **Prisma / ORMs:** generate the client in the build stage and ensure the query-engine binary matches the runtime OS and libc. Do not run migrations at container start silently; ask how migrations are applied (separate job, entrypoint step, or release command).

## 5. Health check

Slim and distroless images have no `curl`. Use Node itself, for example an HTTP request with the built-in `fetch` (Node 18+) or `http` module against the app's health route, exiting non-zero on failure. Point it at a real health route; if none exists, propose adding a minimal one and ask, rather than checking `/`. Set interval, timeout, start period (long enough for startup), and retries.

## 6. Pitfalls

- `.dockerignore` missing `node_modules` copies host-platform binaries into the image and breaks native modules.
- Installing with `npm install` instead of `npm ci` ignores the lockfile.
- `ENV` or `ARG` carrying tokens for private registries leaks them into layers; use `RUN --mount=type=secret`.
- Running `npm run build` in the runtime stage keeps the toolchain and source in the final image.
- File watchers or `nodemon` in the production `CMD`.
- Time zones and locale: set only if the app depends on them.
