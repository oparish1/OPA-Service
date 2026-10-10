# Provision and Harden the Droplet

Stage 1. The order below is what keeps the owner from locking themselves out. Every gate must pass before the next step.

## Contents
1. Decide first
2. Create the droplet
3. First login and non-root user
4. Lock down SSH
5. Firewalls
6. Updates and baseline
7. Deploy user for automation
8. Recovery path
9. Checkpoint

## 1. Decide first (owner commitments)

- Region, plan (size), and the operating system image. Use a current long-term-support Linux release; look up the available images and their support windows rather than assuming.
- Whether to enable IPv6, monitoring, and droplet backups (backups cost extra and are crash-consistent, not a database backup; see `database-and-backups.md`).
- Whether to attach a Reserved IP so the address survives rebuilding the droplet.
- SSH access policy: which public keys, which source networks.
- The names of the admin user and the deploy user.

## 2. Create the droplet

- Add the owner's **public** SSH key to the DigitalOcean account and select it at creation, so the droplet starts with key authentication and no emailed root password. The private key never leaves the owner's machine and never enters chat.
- Prefer a reproducible method the owner can review: the web console for one-off creation, or the CLI or infrastructure code for repeatable creation. Look up the current `doctl` or API syntax in DigitalOcean's documentation rather than writing flags from memory. Present the exact command or configuration for approval, including the cost.
- Optionally use a **cloud-init** user-data script to create the admin user, install the owner's public key, and apply the baseline on first boot; review it before use, since it runs as root. It must contain no secrets.
- Put the droplet in a VPC and, where available, tag it so the firewall can target it.
- Record the droplet's public IP for DNS and the firewall.

**Gate G0:** the owner confirms the droplet exists, its size and region are as approved, and they can reach it as root with their key. Stage 1 continues over this initial session.

## 3. First login and non-root user

As root, once:
1. Create an admin user for humans (name from the owner). Give it sudo through the distribution's admin group.
2. Install the owner's public key in that user's authorized keys, with correct ownership and permissions (directory 700, file 600).
3. Decide sudo policy with the owner: a password for sudo (set interactively; never pass it on a command line or in chat) or passwordless sudo, which is convenient but means a stolen key is full root. Record the choice.
4. Keep the root session open.

**Gate G1 — mandatory:** from a **second** terminal, log in as the admin user with the key and run a privileged command through sudo. Only when this works may the next section begin.

## 4. Lock down SSH

- Make the changes in a drop-in file under the SSH daemon's include directory, or in the main file, but **check for other files that override it**: cloud images can ship drop-ins that re-enable password authentication, and the first value read wins for many options. Inspect the effective configuration with the daemon's test-and-dump mode after editing, not the file you edited.
- Set: root login disabled, password authentication disabled, keyboard-interactive authentication disabled, public-key authentication enabled. Optionally restrict logins to named users and lower authentication attempts. Do not change the port unless the owner insists; it is obscurity, not security, and complicates tooling.
- Validate the configuration with the daemon's syntax check **before** reloading. Use reload, not restart, and keep the existing session open.

**Gate G2 — mandatory:** from a new terminal, confirm (a) admin-user key login still works, (b) root login is refused, (c) a login attempt forcing password authentication is refused. If anything fails, fix it from the still-open session. Only then close the root session.

## 5. Firewalls

Two layers, because they fail differently:

**Network layer: DigitalOcean Cloud Firewall.** Filters before traffic reaches the droplet, costs nothing extra, and (unlike the host firewall) is not bypassed by Docker's rules. Inbound: SSH from the owner's addresses if they are stable (otherwise from anywhere, with the host-level hardening below), HTTP and HTTPS from anywhere, and nothing else. Outbound: allow by default unless the owner has a policy. Apply it to the droplet by tag.

**Host layer: UFW (or the distribution's firewall).** Default deny incoming, default allow outgoing; **add the SSH allow rule first**, then the web ports, then enable. Check the rules list and that SSH is allowed before enabling; enabling first can cut the session.

**Docker bypass warning:** ports published by Docker are inserted ahead of UFW's rules, so `ufw deny` does not hide them. Handle it structurally:
- Publish only the reverse proxy's ports (80, 443, and 443/udp if HTTP/3 is used); leave databases and internal services unpublished, or bind them to loopback.
- Rely on the Cloud Firewall as the authoritative perimeter.
- If host-level filtering of Docker traffic is required, use the dedicated chain Docker provides for user rules, per Docker's current documentation.

**Gate G3:** an external port scan or connection test from the owner's machine shows only the intended ports open (this is confirmed again in Stage 6).

## 6. Updates and baseline

- Apply current package updates and reboot if the kernel changed, while a console recovery path exists.
- Enable automatic security updates and decide with the owner how reboots are handled (scheduled window, manual, or automatic).
- Consider brute-force protection (rate-limited SSH or a ban tool) as an extra layer once password authentication is off; it mainly reduces log noise.
- Confirm time synchronization is on. Set the hostname and timezone as the owner wants.
- For small droplets, agree whether to add swap; it prevents out-of-memory kills at the cost of disk and performance.
- Install the monitoring agent if monitoring is enabled, and configure alerts for CPU, memory, and disk with the owner's thresholds and contacts.
- Keep the package set small; do not install unneeded services.

## 7. Deploy user for automation

Only if a pipeline or scripted deploy is planned:
- Create a separate deploy user with no password, not in the sudo group. Membership in the container group is effectively root on the host, so restrict its key instead.
- Generate a dedicated key pair for deployment on the owner's side; install the **public** key with a forced command that runs one deploy script, with port forwarding, agent forwarding, X11 forwarding, and terminal allocation disabled. The script accepts only a validated image tag.
- The script and the deploy directory are owned by a user the deploy user cannot modify beyond what the script needs.
- Record the server's host key fingerprint from a trusted channel for pinning in the pipeline.

## 8. Recovery path

- Confirm the provider's web console access to the droplet works for the owner's account, and how to reach the recovery options. This is the way back if SSH is misconfigured. Look up the current names and steps.
- Take a snapshot before major changes (SSH lockdown, Docker install, first deploy) if the owner accepts the cost; note snapshots bill until deleted.

## 9. Checkpoint

Stage 1 is complete when G0–G3 passed, the admin user works with key and sudo, root and password logins are refused, both firewalls are configured and confirmed, updates are applied, and the owner knows the recovery path. In guide mode, request the outputs of: the effective SSH configuration for the four settings, the firewall status, and the list of listening ports.
