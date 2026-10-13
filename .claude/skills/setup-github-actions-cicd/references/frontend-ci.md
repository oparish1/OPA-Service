# Frontend: Lint, Security Checks, Tests, Build

Read this when the project contains JavaScript or TypeScript. The commands come from `package.json`, not from convention.

## Contents
1. Detect
2. Setup and caching
3. Lint (ESLint)
4. Type checking
5. Security checks
6. Unit tests
7. Build
8. Monorepos
9. Verify

## 1. Detect

- Package manager from the lockfile: npm, Yarn, pnpm, or Bun. Install with the frozen-lockfile form of that manager (`npm ci` and equivalents); never a plain install that can rewrite the lockfile.
- Node version from `.nvmrc`, `.node-version`, `engines`, or `volta`. Use the version file where the setup action supports it.
- Scripts in `package.json`: lint, typecheck, test, build and e2e. Use the project's script names.
- ESLint configuration format: flat config (`eslint.config.*`) or legacy (`.eslintrc*`). The two are run and extended differently; match the project and its installed ESLint major version.
- Test runner (Jest, Vitest, others), whether it needs a browser environment and coverage configuration.
- Framework build (Vite, Next.js, Angular and so on) and its output directory.

## 2. Setup and caching

- Set up Node with the declared version and the setup action's dependency cache for the detected manager. For pnpm and Yarn, enable the package manager through the project's declared method (Corepack or the manager's own setup action); check current documentation.
- Install from the lockfile. If install scripts are a concern, discuss `--ignore-scripts` with the owner, since some packages need their scripts.

## 3. Lint (ESLint)

- Run the project's lint script; fail the job on errors. Decide with the owner whether warnings fail (a `--max-warnings` limit) or only print.
- Scope to the source directories; respect the project's ignore configuration.
- Existing debt: same policy question as any linter. Options: fix first, lint only changed files on pull requests, or set an agreed warning ceiling that ratchets down.
- Prettier or another formatter: check-only mode, only if the project uses it.
- Important honesty note for the owner: **ESLint is a linter.** It catches security problems only if security-focused plugins and rules are configured (for example a security plugin). If the owner counts ESLint as their frontend security scan, say what it does and does not cover and offer the checks in section 5.

## 4. Type checking

Run the type checker (`tsc --noEmit` or the project's script) as its own step if the project uses TypeScript. It catches a class of bugs tests miss and is fast.

## 5. Security checks

Frontend security scanning is mostly about dependencies and code patterns:
- **Dependency audit:** the package manager's audit command with a severity threshold the owner chooses. Audits can be noisy and flag unreachable paths; agree whether to fail or report and how exceptions are recorded.
- **Automated dependency updates:** Dependabot version and security updates for the ecosystem.
- **Dependency review on pull requests:** GitHub's dependency review action flags newly added vulnerable dependencies; check availability for the repository's plan and visibility.
- **Code scanning (CodeQL):** covers JavaScript/TypeScript and Python; availability depends on repository visibility and plan. Check current documentation and ask the owner.
- **Secret scanning:** a repository setting, not a workflow; recommend enabling push protection.
- **Lockfile integrity:** fail if the install would change the lockfile.

## 6. Unit tests

- Run the project's test script in CI mode (non-interactive, no watch). Ensure the environment variable the runner uses for CI is set (most GitHub runners set `CI`).
- Fail on zero tests found unless accepted. Upload coverage as an artifact; enforce thresholds only if the owner sets them.
- Give tests deterministic time and network settings; mocks belong in tests, not in workflow environment.

## 7. Build

- Run the production build. A build step catches type, bundler and environment errors that tests do not.
- Values injected at build time (public environment variables) are visible in the shipped bundle; never pass real secrets to a frontend build.
- Upload the build output as an artifact when a later job (e2e, deploy, image build) needs it, rather than rebuilding.
- If the app is built into a Docker image, the image build is the authoritative build; do not build twice without a reason.

## 8. Monorepos

- Path filters so a change under one package does not run every pipeline; remember filters mean a required status check may never report, which can block merges. Prefer a small aggregator job that always runs and depends on the path-filtered ones.
- Use the workspace tool's affected-packages command if the project has one (Nx, Turborepo), following its documentation.
- Cache per package lockfile or the root lockfile, as the layout dictates.

## 9. Verify

- Run install, lint, typecheck, tests and build locally with the workflow's exact commands.
- Confirm the lockfile does not change after install and the cache key includes it.
- Confirm each check can fail: reason through or trigger a deliberate violation on a scratch branch.
- Record which security checks are enabled, which are report-only and which need repository settings the owner controls.
