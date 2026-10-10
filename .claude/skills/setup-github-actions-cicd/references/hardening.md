# Pipeline Hardening and Review Checklist

Read this for every pipeline, and use it as the checklist when reviewing existing workflows. A CI system runs other people's code (pull requests, dependencies, third-party actions) next to your secrets, so the defaults must be defensive.

## Contents
1. Permissions
2. Triggers and forks
3. Untrusted input
4. Third-party actions
5. Secrets and environments
6. Repository settings
7. Runners
8. Reliability
9. Review severity list
10. Verify

## 1. Permissions

- Set the repository default token permission to read-only (a setting the owner changes), and declare `permissions` explicitly in every workflow, narrowed per job. Grant write scopes (for example package write, or pull request write) only to the job that needs them.
- A test job needs `contents: read` at most. A job that pushes an image needs package write. A job that comments on pull requests needs pull request write. A deploy job typically needs neither.
- Long-lived cloud credentials in secrets are worse than short-lived federated credentials (OIDC); if deploying to a cloud, prefer federation and grant the identity-token permission only to that job.

## 2. Triggers and forks

- The `pull_request` trigger from a fork runs with a read-only token and **no secrets**. That is the safe default for tests.
- The `pull_request_target` trigger runs with the base repository's secrets and write token. **Never check out or run the pull request's code in it**, and do not build its scripts. Use it only for metadata tasks such as labeling, and understand the risk.
- Workflows triggered by another workflow's completion also run with the base context and access to secrets. If used, validate what they consume (artifacts from an untrusted run are untrusted), check the triggering event and branch, and avoid running that content.
- Deploy jobs run only on push to protected branches or tags, never on pull request events; add an explicit ref and event condition as defense in depth.
- Issue comment and label triggers are attacker-controllable; gate them on the commenter's permission.

## 3. Untrusted input

- Expressions in the runner context like the pull request title, body, head branch name, commit message, and issue text are attacker-controlled. **Never interpolate them directly into a `run:` script**; that is command injection. Pass them through an environment variable and quote them in the script.

```yaml
# unsafe:  run: echo "${{ github.event.pull_request.title }}"
# safe:
- env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "$TITLE"
```

- Treat downloaded artifacts, caches, and generated files from untrusted runs as untrusted.
- Do not `eval` or source untrusted content; validate inputs to `workflow_dispatch` against expected patterns.

## 4. Third-party actions

- Pin every action to a full-length commit SHA, with the human-readable version in a trailing comment. Tags can be moved; SHAs cannot. Look up the current release and its commit when you write it, and keep a comment showing the version.
- Prefer actions from GitHub, Docker, and the tool vendors; review lesser-known actions' source before use, and ask whether a plain shell step would do.
- Enable Dependabot for `github-actions` so pinned SHAs are updated by reviewed pull requests.
- Restrict which actions the repository may run (an organization or repository setting).
- Do not `curl | sh` installers in workflows; pin and verify checksums when downloading tools.

## 5. Secrets and environments

- Store secrets at the narrowest scope: Environment secrets for deploy credentials, so only jobs bound to that Environment (with its protection rules) can read them.
- Protect the production Environment with **required reviewers** and restrict deployment branches and tags to the protected ones.
- Never echo secrets; GitHub masks registered secrets in logs, but derived, transformed, or partial values are not masked. Avoid printing structured data that includes secrets.
- Do not pass secrets on command lines; use environment variables scoped to the step that needs them.
- Rotate secrets when people leave or after suspected exposure; document who can.
- The skill writes secret **names** only, never values.

## 6. Repository settings (owner checklist)

- Branch protection or rulesets on the default branch: require pull requests, require the status checks by their exact job names (aggregate job for path-filtered or matrix checks), require up-to-date branches if desired, block force pushes, and restrict who can push.
- CODEOWNERS covering `.github/workflows/` so pipeline changes get a security-aware review.
- Default workflow token permission set to read-only; disallow Actions from approving pull requests.
- Require approval for workflow runs from first-time or outside contributors.
- Enable secret scanning and push protection; enable Dependabot alerts.
- Enable code scanning if the plan supports it (check current availability).

## 7. Runners

- GitHub-hosted runners are ephemeral and isolated per job; prefer them.
- Self-hosted runners persist between jobs and run whatever code reaches them. **Do not attach self-hosted runners to public repositories or fork pull requests.** If needed, make them ephemeral and isolated, and limit which workflows may use them.
- Do not run privileged containers or mount the Docker socket into jobs handling untrusted code.

## 8. Reliability

- `timeout-minutes` on every job so a hang does not consume the plan.
- `concurrency` groups to cancel superseded CI runs, but never cancel deploys.
- Cache keys include the lockfile hash; cache restore keys are narrow.
- Deterministic installs from lockfiles; no floating tool versions.
- Retry only known-flaky network steps, not tests.
- Clear step names and job summaries for diagnosis; upload artifacts (reports, traces) with limited retention.
- Avoid `continue-on-error` on checks; if used, record the reason in a comment and in the report.
- Scheduled workflows are disabled on inactive repositories after a period; note this for scheduled scans.

## 9. Review severity list

**Critical:** secrets or write tokens reachable by fork pull requests; `pull_request_target` running untrusted code; expression injection in `run:`; secrets or keys in the repository or logs; SSH host-key checking disabled with a production key; deploy reachable without the gate; a mutable `latest` deployed to production.

**High:** broad or implicit `permissions`; unpinned third-party actions; long-lived cloud keys where federation exists; deploy without concurrency control or health check; self-hosted runners on public repositories; workflow_run consuming untrusted artifacts.

**Medium:** missing timeouts; missing caches keyed on lockfiles; checks that cannot fail or use `continue-on-error`; no branch protection matching job names; no CODEOWNERS for workflows; no Dependabot for actions.

**Low:** unclear job names, missing summaries, retention not set, duplicated steps.

Report each finding with the file and line, why it matters in one sentence, and the exact fix. Include what is already good so it is kept, the top three fixes by impact, any behavior change a fix causes, and what could not be verified.

## 10. Verify

- Every workflow declares `permissions`; none is broader than its job needs.
- No `pull_request_target` job checks out or executes pull request code.
- No untrusted expression is interpolated into a shell script.
- Every action is pinned to a commit SHA with a version comment.
- Deploy jobs are bound to a protected Environment, restricted to trusted refs and events, and use serialized, non-cancelling concurrency.
- No secret values appear in the files; the owner checklist lists every secret and variable by name.
- The listed repository settings are recorded as owner tasks, not assumed to exist.
