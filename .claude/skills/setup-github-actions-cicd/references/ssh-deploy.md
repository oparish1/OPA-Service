# Deployment over SSH

Read this when the pipeline deploys to a server it reaches over SSH. This is the riskiest part of the pipeline: it holds a credential that can change production. Design it so that credential can do very little.

## Contents
1. Decide first
2. Server-side setup (owner does this)
3. What the workflow does
4. Health check and rollback
5. Concurrency and ordering
6. Migrations and state
7. Network exposure
8. Pitfalls
9. Verify

## 1. Decide first (owner commitments)

- Host, user, application directory, and how the app runs on the server (compose, systemd, a script). The skill reads this from the project or the owner; it does not invent paths.
- Automatic on merge, or gated by required reviewers on a protected Environment. Default to the gate for production.
- Environments: staging then production, or a single one.
- Downtime tolerance: a compose recreate causes a short interruption; zero-downtime needs a different mechanism (a proxy switch, blue/green) and is a separate design.
- Rollback: who triggers it and how (rerun a previous deploy by tag, or a manual workflow with a chosen tag).
- Migrations: how they run and how failures are handled.

## 2. Server-side setup (owner does this; the skill lists it in the checklist)

- A **dedicated deploy user** with no shell privileges beyond what deployment needs, not root, and not the account administrators use.
- A dedicated key pair generated for this purpose (a modern key type), with the private key stored **only** as a GitHub secret (Environment-scoped) and the public key in the deploy user's authorized keys.
- Restrict the key in authorized keys: forced to run one fixed deploy script (`command=`), and with options that disable port forwarding, agent forwarding, X11, and pty. With a forced command the key cannot be used for anything else even if leaked.
- The deploy script on the server takes the image tag or digest as its only argument, validates it against a strict pattern, logs in to the registry with a read-only credential kept on the server, pulls that image, updates the running service, runs the health check, and rolls back on failure.
- The server's own application secrets (database URL, API keys) stay in an env file on the server, owned by the deploy user and unreadable by others. The workflow never writes or overwrites them.
- Record the server's SSH host key fingerprint out of band (from the provider console or by logging in yourself), so the workflow can pin it.

## 3. What the workflow does

- Runs only for trusted refs (the default branch or release tags) and never for forks, in a job bound to the protected Environment so the required-reviewer gate and environment-scoped secrets apply.
- Minimal `permissions`: it needs to read the repository at most; pushing is a different job.
- Inputs: the image tag or digest produced by the build job in the same run.
- Installs the private key from the secret into a temporary file with restrictive permissions, and **pins the host key** by writing the expected `known_hosts` entry (stored as a secret or variable) and enabling strict host-key checking. **Never disable host-key checking** and never use blanket "accept new keys".
- Connects with the fixed user and runs the deploy command (or triggers the forced command) passing only the tag. Secrets are never put on the command line where they can appear in process listings or logs.
- Removes the key file at the end (the runner is ephemeral, but do it anyway) and does not echo it.
- Alternatives to consider with the owner: a maintained SSH action (look up, pin, and review it since it handles the key), or a pull-based model where the server polls for new tags and deploys itself, which removes inbound SSH from CI entirely.

## 4. Health check and rollback

- After the service is updated, poll the application's health endpoint (from the workflow through the public URL, or on the server locally) with a bounded timeout. The health check must test the app, not just that a port is open.
- On failure: the deploy script restores the previous image tag, verifies health again, and the job fails loudly with the reason. The previous tag is recorded on the server before the update.
- Keep the last N images on the server so a rollback does not depend on the registry being reachable.
- Provide a manual **redeploy or rollback** path: a workflow dispatch that takes a tag, deploys it through the same gated job.
- Send a notification (chat, email) on deploy success and failure if the owner wants it; use a secret webhook, not a public one.

## 5. Concurrency and ordering

- Use a `concurrency` group per environment so two deploys never run at once, and **do not cancel in progress** for deploy groups; cancelling mid-update can leave the server half-updated.
- Deploy only commits whose required checks passed: enforce with job dependencies in the same workflow, or protected branches plus a deploy that triggers only from the protected ref.
- If a separate deploy workflow is triggered by completion of another workflow, be careful: such triggers run in the context of the default branch with access to secrets and can be reached by untrusted runs unless conditions are checked. Prefer the same-workflow `needs:` design (see `hardening.md`).

## 6. Migrations and state

- Decide how migrations run: in the deploy script before switching traffic, or as a separate gated job. Make them backward compatible with the previous release, so a rollback of the app does not meet a schema it cannot read.
- Never let the pipeline drop data or reset volumes. Destructive operations are manual.
- Back up before risky migrations; that is an owner procedure noted in the checklist.

## 7. Network exposure

- GitHub-hosted runners come from large, changing IP ranges, so allowlisting them at a firewall is impractical and weak. Options: keep SSH exposed but hardened (key-only, no password login, rate limiting or fail2ban, non-default configuration is optional), use a bastion, use a self-hosted runner inside the network (with the security cautions in `hardening.md`), or use the pull-based model.
- Disable password authentication and root login on the server.

## 8. Pitfalls

- `StrictHostKeyChecking=no` or `ssh-keyscan` at deploy time (trusts whatever answers).
- One all-powerful key reused across servers and projects.
- Deploying `latest`, then being unable to say what is running.
- Overwriting the server's env file from CI.
- A health check that only tests that the container is running.
- No rollback path, discovered during an incident.
- Deploy job reachable from pull requests or forks.
- Echoing or logging the key or connection strings.

## 9. Verify

- The deploy job is bound to the Environment, runs only on trusted refs, and depends on all required checks.
- Host key is pinned; strict checking is enabled; no `keyscan` or disabling flags exist.
- The workflow contains no secret values and passes none on command lines.
- The image reference is a SHA tag or digest from this run.
- A forced-command key restricts what the key can do (owner confirms).
- Health check and rollback exist and were exercised by the owner in a drill.
- State what only a real run proves: connectivity, the server script, permissions, and the rollback drill.
