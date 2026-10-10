# Docker Build, Cache, Tags, Push, and Image Scanning

Read this when the pipeline builds container images. If the repository has no Dockerfile, use the `containerize-application` skill first.

## Contents
1. Decide first
2. Build on every change, push only from trusted refs
3. Registry and authentication
4. Tags and immutability
5. Caching
6. Multi-platform builds
7. Image scanning and supply chain
8. Build secrets
9. Verify

## 1. Decide first (owner commitments)

- Registry: GitHub Container Registry (authenticated with the workflow token) or another (credentials as secrets); image visibility; the image name and namespace.
- Which refs push images: typically the default branch and release tags, never fork pull requests.
- Tagging scheme (section 4) and retention: how long old images are kept and who cleans them up.
- Target architectures: match the deploy host (amd64, arm64, or both).
- Whether the scan blocks the build, and at what severity.

## 2. Build on every change, push only from trusted refs

- On pull requests, **build without pushing** to prove the Dockerfile works and catch regressions. Load the image into the runner if a later job (e2e, scan) needs it.
- On the default branch and tags, build and push.
- Fork pull requests cannot push and have no registry credentials; the build-only path must work without them.
- Use the Docker organization's official actions for buildx setup, registry login, metadata (tags and labels), and build/push. Look up the current version of each, pin, and cite.

## 3. Registry and authentication

- GHCR: log in with the workflow's built-in token and grant only the package write permission to the job that pushes. Image names must be lowercase; derive them from the repository context safely.
- Other registries: store credentials as secrets, scoped to the registry and pushing role only; prefer short-lived credentials or OIDC federation where the provider supports it.
- The server that pulls for deployment uses a separate **read-only** credential, kept on the server, not in the workflow.
- Never print credentials; do not pass them as build arguments.

## 4. Tags and immutability

- Tag every pushed image with the commit SHA (immutable, traceable). Add human-friendly tags (branch, release version) via the metadata action if useful.
- **Deploy by the SHA tag or the digest, never by `latest`.** A mutable tag makes rollback and audit ambiguous. If `latest` exists at all, it is a convenience alias.
- Record the digest produced by the build as a job output so the deploy job uses exactly what was built and scanned.
- Add OCI labels for source repository and revision through the metadata action.

## 5. Caching

- Use buildx layer caching backed by the Actions cache or a registry cache; check current documentation for the supported backends and their size limits.
- Cache effectiveness depends on Dockerfile layer order (dependencies before source); if builds are slow, review the Dockerfile before tuning the workflow.
- Language package caches used inside the build can use BuildKit cache mounts defined in the Dockerfile.
- Cache poisoning consideration: caches written by pull request runs from forks are not shared with the default branch scope by design; do not rely on them for trusted builds.

## 6. Multi-platform builds

- Only build the architectures you deploy. Emulated builds (QEMU) are much slower than native.
- If both are required, consider separate native runners per architecture and a manifest merge, per current buildx documentation.

## 7. Image scanning and supply chain

- Scan the built image for known vulnerabilities with a maintained scanner (for example Trivy or Docker Scout); look up the current action. Scan **before** pushing to a trusted tag or before deploying.
- Severity threshold and whether to fail are owner decisions. Unfixed vulnerabilities in base images will otherwise block every build; support an ignore file with justifications and expiry, reviewed like code.
- Optionally generate an SBOM and build provenance/attestation; these need extra permissions and repository features, so check availability and ask.
- Rebuild on a schedule so base-image fixes flow in even without code changes.
- Pin the base image tag in the Dockerfile and use Dependabot's Docker ecosystem to propose updates.

## 8. Build secrets

- Never pass secrets as build args or environment variables in the Dockerfile; they remain in layers and history. Use BuildKit secret mounts and the build action's secrets input.
- Application runtime secrets are not part of the image. They live on the server or in the deploy platform.

## 9. Verify

- The Dockerfile builds locally with the same context and arguments.
- The pull request path builds without pushing and without credentials.
- The pushed tag is the commit SHA, and the deploy job consumes the digest or SHA tag, not `latest`.
- The job has only the permissions it needs.
- The scan step fails on the agreed severity (reason through it or trigger it on a scratch branch).
- State what only a real run proves: registry permissions, package visibility, and cache hit rates.
