# Go

Go compiles to a single binary, so the final image can be extremely small. The trade-off is that a minimal image has no shell or tools, which shapes the health check and debugging story.

## Contents
1. What to read in the project
2. Base image
3. Dockerfile pattern
4. Health check
5. Pitfalls

## 1. What to read in the project

- `go.mod`'s `go` directive for the toolchain version; `go.work` for workspaces. Pin the builder image to that version family.
- The `main` package to build (`cmd/<name>`): projects often have several binaries. Ask if more than one is a plausible deployable.
- Whether cgo is used (`import "C"`, or dependencies such as some SQLite drivers). This decides static vs dynamic linking.
- The listen address and port, and whether they are configurable through env or flags.
- Files the binary reads at run time: templates, migrations, static assets, config. If they are not embedded (`//go:embed`), they must be copied into the image.
- Whether the binary makes TLS requests (needs CA certificates) or uses time zones (needs tzdata).

## 2. Base image

- Builder: the official Go image at the pinned version.
- Final stage, in order of preference for a static binary: a distroless static image with the non-root variant (look up the current tag), or `scratch` with CA certificates, tzdata, and a numeric user added manually. Use a slim Debian/Alpine image only when the binary needs a shell or dynamic libs.
- If cgo is required, either build with a matching libc in a glibc-based final image, or replace the cgo dependency (for instance a pure-Go driver) if the owner agrees. Do not set `CGO_ENABLED=0` and hope; the build may succeed and the binary fail at run time.

## 3. Dockerfile pattern

- Builder: copy `go.mod` and `go.sum`, `go mod download` (cache mount for the module cache), then copy source and build.
- Build flags: `CGO_ENABLED=0` (only when no cgo), `-trimpath`, and `-ldflags="-s -w"` to shrink; pass version info with `-X` ldflags from a build arg if the app reports one. Set `GOOS`/`GOARCH` from the build platform args for multi-arch images.
- Final stage: copy the binary (and any non-embedded assets), use a non-root numeric user (`USER 65532:65532` in the distroless nonroot image), `EXPOSE` the port, exec-form `ENTRYPOINT ["/app"]`.
- Go programs are their own PID 1 and receive signals; confirm the code handles `SIGTERM` with `http.Server.Shutdown`. An init is unnecessary unless the program spawns child processes.
- Container CPU/memory limits: recent Go versions consider cgroup CPU limits for parallelism, older ones do not. Check the Go version, and set `GOMAXPROCS`/`GOMEMLIMIT` deliberately if limits are tight.

## 4. Health check

A distroless/scratch image has no `curl`, `wget`, or shell, so a `HEALTHCHECK CMD curl ...` silently fails. Options, in order of preference:
1. Add a `healthcheck` subcommand or flag to the binary that performs the HTTP request and sets the exit code, and call it from `HEALTHCHECK` (exec form).
2. Use the orchestrator's HTTP probe (Kubernetes, ECS, load balancer) and omit `HEALTHCHECK` from the Dockerfile, saying so.
3. Use a slim image with `wget` or `curl` installed, accepting the larger surface.

Ask the owner before changing application code to add option 1.

## 5. Pitfalls

- A dynamically linked binary in `scratch` fails with a confusing "no such file or directory".
- Missing CA bundle: outbound HTTPS fails with certificate errors.
- Missing tzdata: `time.LoadLocation` fails.
- Copying the whole repository into the builder before `go mod download` defeats layer caching.
- Stripping symbols makes stack traces less useful; note the choice.
- Writing to the filesystem when the image or compose file makes it read-only; give the app a declared state path.
