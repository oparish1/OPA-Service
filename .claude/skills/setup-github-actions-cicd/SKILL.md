---
name: setup-github-actions-cicd
description: Sets up CI/CD for a project with GitHub Actions — automated Docker builds, unit tests, linting (Flake8, ESLint), security scanning (Bandit for Python, dependency and code scanning for the frontend), end-to-end tests (Playwright), and gated automated deployment over SSH — after reading the codebase to detect the real languages, package managers, test runners, and existing workflows. Writes the workflow files, then verifies and hands the owner a checklist of secrets, environments, and branch protection to configure. Also reviews and hardens existing workflows. Use whenever the user asks to set up CI/CD, add GitHub Actions, add a pipeline, automate tests, builds, or deployment, make pushes or pull requests build, test, and deploy automatically, add Playwright or Bandit or ESLint to CI, deploy over SSH, or review or fix an existing .github/workflows file — even if they only say "I want this to deploy when I push".
metadata:
  arguments: "[project-path]"
---

# Set Up CI/CD with GitHub Actions

## Objective

A pipeline that goes green is not a pipeline that is safe. The usual failures are quiet: a deploy job that fork pull requests can trigger, a `pull_request_target` workflow that checks out untrusted code with secrets in reach, an SSH step that disables host-key checking, a token with write access to everything, an image deployed by a mutable `latest` tag, a lint step that never fails the build, or a test job that passes because it ran zero tests. This skill reads the project to learn what it actually is, asks about the decisions that belong to the owner, writes the workflow files, and states plainly what only a real run can prove.

**Governing rule: every command, runtime version, branch name, blocking policy, registry, and deploy target comes from the project or the owner — never from what is conventional.** Do not assume `pytest`, `npm test`, `main`, or `latest`. Where the code does not settle it, ask. Second rule: **the skill never creates, prints, or embeds secrets or keys.** It references secrets by name and gives the owner a checklist to create them.

## Arguments

`setup-github-actions-cicd [project-path]`. Default to the current project root. Workflow files go in `.github/workflows/` at the repository root; in a monorepo, confirm which packages get pipelines.

## Process

### Step 0: Detect the project (read before writing anything)

Invoke the **prime-codebase** skill if available; otherwise read the project yourself. Establish from the files:

- **Repository:** default branch, existing branch and release conventions, monorepo or single project, remote host (this skill targets GitHub).
- **Languages and package managers:** lockfiles decide (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `uv.lock`, `requirements*.txt`, `go.mod`). Read the runtime versions the project declares (`.nvmrc`, `engines`, `.python-version`, `requires-python`); do not choose one.
- **Real commands:** how the project runs lint, typecheck, unit tests, build, and e2e, from its scripts, Makefile, tox/nox, or docs.
- **Linters and scanners already configured:** Flake8 (`.flake8`, `setup.cfg`, `tox.ini`), Ruff, Bandit config, ESLint config (flat `eslint.config.*` or legacy `.eslintrc*`), Prettier, type checkers.
- **Tests:** frameworks, whether a database or other service is needed, and whether Playwright is present (`playwright.config.*`), including its `webServer` and `baseURL` setup.
- **Docker:** Dockerfile(s), compose files, and the port and health check. If there is none and the user wants image builds or container deploys, route to the **containerize-application** skill first.
- **Existing CI:** any workflows, other CI systems, Dependabot config, CODEOWNERS, branch protection hints. Extend or replace deliberately; never leave two pipelines doing the same job.
- **Deployment clues:** deploy scripts, compose files meant for a server, documentation of the target host.

Summarize findings back to the user in a few lines. Flag anything ambiguous. Note the honest gaps (for example, "no tests found", "ESLint is configured but has no security plugin").

### Step 1: Ask what the code does not settle

Ask rather than assume; use a chat-native elicitation tool if available. Ask only what Step 0 left open, and lead with what you found:

1. **Blocking policy:** which checks must pass to merge (lint, unit tests, security scan, e2e, image build) and which only report. For Bandit or ESLint findings on an existing codebase, block on new findings only, or on everything? A red-from-day-one pipeline gets ignored.
2. **Triggers:** pull requests to which branches, pushes to which branches, tags for releases, manual runs, scheduled scans.
3. **Registry:** GitHub Container Registry or another; public or private images.
4. **Deploy target and mode:** a single host over SSH (host, user, path, how the app is started), automatic on every merge to the default branch or approval-gated, single environment or staging plus production, and downtime tolerance.
5. **Migrations and state:** how database migrations run on deploy, and what must never be redeployed blindly.
6. **Rollback:** how to return to the previous version, and who decides.
7. **Repository facts you cannot see:** private or public, plan features (environments with required reviewers, code scanning), who administers repository settings and secrets.
8. **Cost and speed:** runtime budget, whether to shard or cache aggressively.

If the user says "you decide", decide, state the choice and the reason, and mark it easy to change. Never auto-deploy to production by default; the recommended default is a protected GitHub Environment with required reviewers.

### Step 2: Design the job graph

Sketch it in a few lines before writing YAML. A typical shape, adapted to what exists:

- Fast, independent checks in parallel: lint, typecheck, unit tests, security scan.
- Image build after they pass (build without pushing on pull requests; push only from trusted branches).
- E2E against the built app or stack.
- Deploy only on trusted refs, after everything required is green, into a protected environment, with serialized runs and a health check.

Decide per job whether it blocks. One workflow with `needs:` is simplest; use a separate deploy workflow or reusable workflow only when the owner needs different triggers, and note the security implications of `workflow_run` (`references/hardening.md`).

### Step 3: Load the reference for each piece

Read only what applies:

- Python lint, Bandit, tests: `references/python-ci.md`
- Frontend lint, security checks, tests, build: `references/frontend-ci.md`
- Playwright end-to-end: `references/e2e-playwright.md`
- Docker build, cache, tags, push, image scanning: `references/docker-build-push.md`
- Deployment over SSH, health check, rollback: `references/ssh-deploy.md`
- Permissions, pinning, secrets, forks, branch protection (always, for every pipeline): `references/hardening.md`

**Action versions and features drift.** Look up the current supported version of every action and tool in its documentation, pin as `hardening.md` describes, and cite the source of any version you choose. Do not write versions from memory.

### Step 4: Write the files

Baseline for every workflow, each with a reason in your summary:

- Least-privilege `permissions`, set explicitly at workflow or job level.
- Pinned actions; explicit `timeout-minutes` on every job; `concurrency` to cancel superseded runs (but never cancel an in-progress deploy).
- Dependency caching keyed on the lockfile.
- No untrusted expressions interpolated into `run:` scripts; secrets only where needed, never on command lines.
- Fork pull requests get no secrets and never reach a deploy job.
- Job names stable and meaningful, because branch protection matches on them.
- Clear failure signals: a step that cannot fail is not a check.

Write `.github/workflows/ci.yml` (and `deploy.yml` if separate), plus `.github/dependabot.yml` for the ecosystems and actions in use if the owner agrees. Keep application secrets, production env files, and server credentials out of the repository.

### Step 5: Verify

1. Validate YAML and workflow syntax: run `actionlint` if available; otherwise parse the YAML and re-read every job dependency, expression, and path against the repository.
2. Run each underlying command locally where possible (lint, tests, build) so the workflow does not encode commands that never worked. Report what ran.
3. Confirm every secret and variable the files reference is listed in the owner checklist, and that nothing sensitive appears in the files.
4. Check that each fork-PR, untrusted-input, and production-deploy guard from `hardening.md` is present.
5. State plainly what cannot be proven here: the first real run, secrets and environments existing, branch protection, the server side of the deploy, and third-party action behavior.

Never claim a pipeline passes that has not run on GitHub.

### Step 6: Deliver

Save the files. Summarize in a short list: files written; job graph and which jobs block; decisions made and where you asked; and the **owner checklist** — the secrets and variables to create (names only), the environment and its required reviewers, branch protection rules and the status-check names to require, repository settings to change (default token permission, Actions allowed), the server-side setup for deploy (dedicated user, restricted key, pinned host key), and how to test safely (a first run on a branch, a manual dispatch, a rollback drill). Do not commit or push unless asked.

## Review mode (existing workflows)

When asked to review or harden existing workflows: read them against the project (Step 0) first, then use `references/hardening.md` as the checklist. Report findings by severity with the file and line, why it matters, and the fix; change nothing until the user agrees, unless they asked you to harden directly.

## Do not

- Do not create, print, or embed secrets, tokens, private keys, or `known_hosts` contents; reference secrets by name.
- Do not use `pull_request_target` to run untrusted code, and never give fork pull requests secrets or a path to deploy.
- Do not disable SSH host-key checking, or deploy by a mutable tag such as `latest`.
- Do not grant broader `permissions` than a job needs, or leave them implicit.
- Do not add a check that cannot fail, or one that fails the build from day one without the owner's agreement.
- Do not write action or tool versions from memory.
- Do not auto-deploy to production unless the owner explicitly decides it and the environment gate still exists.
