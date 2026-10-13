---
name: deploy-to-digitalocean
description: Guides provisioning, hardening and deploying a Dockerized application stack to a DigitalOcean droplet — SSH key setup, a non-root sudo user, root and password login lockdown, firewalls (cloud and host), Docker installation, DNS records and HTTPS, database setup and backups, the docker compose deployment itself and a verification and rollback runbook — after confirming the app's compose file, ports and environment variables and getting the owner's approval of a written server plan before anything touches a live server. Defaults to guide mode (a reviewable plan plus exact commands the owner runs); executes step by step only where access exists and the owner approves each change. Use whenever the user asks to deploy to DigitalOcean or a droplet, set up or ship to a production server or the cloud, host a Docker Compose app on a VPS, or harden, secure, or lock down a new or existing Linux server — including "how do I get this live".
metadata:
  arguments: "[project-path]"
---

# Deploy to DigitalOcean

## Objective

Standing up a server is easy; standing up one that stays safe and recoverable is not. The failures are quiet or immediate: root login disabled before the new user's login was tested, so the owner is locked out; a firewall enabled before SSH was allowed; a database port published to the internet because Docker bypasses the host firewall; a `.env` committed or pasted into chat; an app deployed by `latest`; backups that were never restored; a bill from forgotten volumes. This skill confirms what the app is, gets the owner's decisions and cost approval, writes a server plan for sign-off, then walks the stages in a lockout-safe order with a checkpoint after each.

**Governing rule: every region, droplet size, port, domain, retention period and access rule comes from the project or the owner — never from convention.** Droplet plans and prices, image names, `doctl` flags, DNS behavior and managed-database engines change; look them up in current DigitalOcean documentation, cite them in the plan and date any cost figure. Second rule: **the skill never sees, stores, or writes secrets** — API tokens, SSH private keys, database passwords, `.env` values. It references them by name and tells the owner where to create them. Third rule: **no live change without a checkpoint** — cost, destructive and access-affecting actions need the owner's explicit confirmation.

## Arguments

`deploy-to-digitalocean [project-path]`. Default to the current project root.

## Modes

- **Guide mode (default):** produce the server plan and exact, reviewable commands (or a cloud-init script); the owner runs them and reports results. This is the only mode this skill can vouch for from a sandbox without server access.
- **Execute mode:** apply steps through SSH or `doctl` only where the environment already provides access (an authenticated CLI, an SSH session the owner opened) **and** the owner approves each step. Never ask for a token or key in chat. If access is not clearly available, stay in guide mode.

In both modes, the report distinguishes **verified** (a command ran and its output was seen) from **instructed** (the owner was told what to run). Never mark instructed steps as verified.

## Process

### Step 0: Confirm the application (before touching any server)

Invoke **prime-codebase** if available. Establish from the files and read back to the owner for confirmation:

- **Containerized?** A production Dockerfile and a compose file. If not, stop and route to **containerize-application**.
- **Compose file location(s):** base file, override files, proxy file (for example Caddy) and which combination runs in production.
- **Services and images:** which are built from source and which pulled; the registry and tag policy. Prefer deploying a pinned tag pulled from a registry over building on the server.
- **Ports:** container ports, which are published and which must not be reachable from outside (databases, caches, admin UIs).
- **Environment variables:** the full list of names the code and compose file read, which are secrets, which have safe defaults and which differ from local development. Names only.
- **Volumes and state:** what persists, where and current sizes if known.
- **Health checks and startup order.**
- **Proxy and TLS:** Caddy or another reverse proxy, the domain it expects.
- **Database:** engine and version and whether it runs in compose or is external.
- **Migrations:** how they run.

Do not proceed to Step 2 until the owner confirms this summary, especially ports and env var names. A wrong port or a missing variable found on a live server costs time and risk.

### Step 1: Interview the owner

Ask rather than assume; use a chat-native elicitation tool if available. Cover:

1. **DigitalOcean account:** existing team or new; who holds billing and administration; whether the owner has an SSH key pair and will share only the **public** key.
2. **Region:** where users are, data-residency needs and proximity to a managed database if used.
3. **Size and cost:** expected traffic, memory footprint of the stack and the monthly budget. Look up current droplet plans and prices and present options with the date of the figures.
4. **Environments:** production only, or staging too; whether staging should be a smaller separate droplet.
5. **Domain and DNS:** the domain, where DNS is hosted (DigitalOcean or elsewhere) and who can change records.
6. **Database:** managed database or container, engine, data sensitivity and recovery objectives (how much data loss and downtime are tolerable).
7. **Backups:** droplet backups, database backups to off-server storage, retention and who can restore.
8. **Access:** who needs SSH, from which networks and whether the SSH port can be restricted to known addresses.
9. **Operations:** monitoring and alert contacts, how updates and reboots are handled, log retention.
10. **Compliance and email:** any regulatory constraints; whether the app sends email (outbound mail from droplets has provider restrictions; check current policy).
11. **CI/CD:** whether a pipeline will deploy later (this changes what access is prepared).

If a dimension goes unanswered, mark it *unresolved* in the plan. Do not fill it in.

### Step 2: Write the server plan and get it approved

Write `do-deployment-plan.md`. Contents:
- The confirmed application summary from Step 0.
- A decisions table: each decision, value, source (`owner` or `unresolved`) and the owner's words or the question that resolves it.
- The ordered runbook for the stages below, each with its checkpoint gate ("do not continue until…"), its rollback and who runs it.
- A cost estimate (droplet, backups, volumes, managed database, snapshots, reserved IP, bandwidth if relevant) labeled with the source and date and a list of what keeps billing after a droplet is destroyed.
- Risks and the recovery path if access is lost (the provider's web console or recovery options; confirm the current names in documentation).

Present it and wait for approval. No live change happens before approval.

### Step 3: Run the stages, in this order

Read the reference for each stage. Order matters; do not reorder.

1. **Provision and harden the server** (droplet, SSH keys, non-root user, SSH lockdown, firewalls, updates): `references/provision-and-harden.md`
2. **Install Docker and prepare the deploy directory:** `references/docker-on-droplet.md`
3. **Database:** `references/database-and-backups.md`
4. **Deploy the stack** (copy files, create the server-side env file, pull pinned images, start, health check): `references/docker-on-droplet.md`
5. **DNS and HTTPS:** `references/dns-and-tls.md`
6. **Verify and prepare rollback:** `references/verify-and-rollback.md`

After each stage, run its checkpoint. In guide mode, ask the owner to paste the command output (with secrets removed) before you mark the stage complete. Stop and fix anything that fails before moving on.

### Step 4: Verify and report

Follow `references/verify-and-rollback.md`. Write `do-deployment-report.md` from its template: each check, how it was performed, the result and whether it is **verified** or **instructed**. The verdict may say **live and hardened** only when the security, reachability, persistence and backup-restore checks are verified; otherwise **not yet**, with the blocking items named.

### Step 5: Hand off

Give the owner:
- A short operations sheet: how to deploy a new tag, roll back, view logs, restart, renew nothing manually (TLS is automatic if configured) and where backups live.
- The cleanup and cost notes: what to destroy and what still bills.
- If a pipeline will follow, the **CI/CD handoff checklist** for `setup-github-actions-cicd`: the deploy user name, the restricted deploy key (public half installed on the server; private half only in the repository's protected Environment secret), the pinned host-key fingerprint, the deploy script path and its argument contract, the read-only registry credential on the server and the health URL.

## Review mode (an existing droplet)

When asked to harden or audit a server that already exists: start with **read-only** commands (SSH daemon effective configuration, firewall status, listening ports, running containers, user and sudo configuration, update status), have the owner run them or run them with approval and compare against `references/provision-and-harden.md`. Report findings by severity with the evidence and the fix; change nothing until the owner agrees and apply access-affecting changes only in the lockout-safe order.

## Do not

- Do not disable root login or password authentication before a second session has proven the new user's key login and sudo work.
- Do not enable a firewall before the SSH allow rule exists.
- Do not publish database, cache, or admin ports to the internet and do not rely on the host firewall alone to hide Docker-published ports.
- Do not ask for, print, or write API tokens, private keys, passwords, or `.env` contents; do not commit them.
- Do not deploy by `latest` or an unpinned tag.
- Do not create billable resources or run destructive commands (delete, rebuild, resize, prune, volume removal) without explicit confirmation.
- Do not write prices, sizes, image names, or CLI flags from memory.
- Do not mark a check verified that was only instructed.
