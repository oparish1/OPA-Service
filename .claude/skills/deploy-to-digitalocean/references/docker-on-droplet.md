# Docker on the Droplet and the Stack Deployment

Stages 2 and 4. Install Docker cleanly, prepare the deploy directory, and start the stack from a pinned image with secrets created on the server.

## Contents
1. Install Docker
2. Daemon settings
3. Deploy directory and files
4. Environment file and secrets
5. Registry access
6. First deploy
7. Later deploys
8. Checkpoint

## 1. Install Docker

- Install Docker Engine and the Compose plugin from Docker's official package repository, following Docker's current instructions for the droplet's distribution. Avoid the distribution's older bundled package unless the owner accepts it. Verify the repository signing key per the instructions.
- Confirm the daemon starts at boot and the Compose plugin works (`docker compose version`).
- Do not add the admin user to the container group casually; that group is root-equivalent. Use sudo for administration, or accept the group knowingly and record it.
- Consider rootless mode only if the owner wants that trade-off; it changes networking and port behavior.

## 2. Daemon settings

- Configure log rotation for the default log driver (a maximum size and file count) so container logs cannot fill the disk. The numbers are the owner's call; give a starting value labeled as a suggestion.
- Keep the default bridge behavior unless there is a reason; do not set the daemon to bypass its firewall rules without understanding `provision-and-harden.md` section 5.
- Restart Docker only when no critical container is running, or accept the brief interruption.

## 3. Deploy directory and files

- Create a directory for the application (path from the owner, commonly under `/opt`), owned by the user that operates it, mode restrictive.
- Copy only what the server needs: the production compose file(s), the proxy configuration (for example a Caddyfile), and any config files the stack mounts. Do not copy source code or `.git` if images are pulled from a registry.
- Transfer files over SSH with the owner's key; never commit server-specific files.
- Validate the merged configuration with the Compose config command before starting; read the resolved ports and volumes and compare to the confirmed list from Step 0.
- Ensure only the reverse proxy publishes ports; databases and internal services use the internal network.

## 4. Environment file and secrets

- The `.env` (or secret files) is created **on the server**, by the owner, with values the owner generates. Give the owner the list of variable names from Step 0, mark which are secrets, and show how to create the file so values do not land in shell history: write it with an editor, or read values from a prompt, not with the value in a command line.
- Permissions: readable by the operating user only. Confirm the file is excluded from any repository and from image builds.
- Generate strong random values for passwords and keys with a cryptographically secure generator; do not reuse local development values.
- Production-only values: the public URL, the allowed hosts, database connection strings, and provider keys should differ from development. Confirm each is set before the first start; a missing variable often produces a subtle failure rather than a clear one.
- Record where the secrets are backed up (a password manager, a secrets service) so a rebuilt droplet can be restored. The skill does not hold them.

## 5. Registry access

- If images come from a private registry, create a **read-only** credential on the registry side and log in on the server with it. Credentials are stored in the Docker client config for that user; restrict file permissions and prefer a credential helper if the owner wants stronger storage.
- Public images need no login. Confirm the image names and pinned tags exactly match the compose file.
- Building on the droplet is possible but uses its CPU and memory and leaves build tooling on a production host; prefer building in CI or elsewhere and pulling.

## 6. First deploy

1. Snapshot the droplet if the owner wants a restore point.
2. Pull the images (pinned tags or digests) and confirm the digests are what was built and scanned.
3. Start database and dependencies first if they are in the stack, wait for their health checks, run migrations as agreed (one-off, not on every start), then start the application and proxy.
4. Watch the logs of the first start for missing variables, permission errors, and port conflicts.
5. Check container health and that restart policies are set so the stack returns after a reboot.
6. Test the app through the server's local address first, before DNS and TLS are in place, then proceed to `dns-and-tls.md`.

## 7. Later deploys

- Deploy by changing to a new **pinned tag** and running pull then up; record the previous tag before the change so rollback is one step (`verify-and-rollback.md`).
- Migrations must be backward compatible with the previous release.
- Prune old images on a schedule the owner accepts; keep at least the previous release image on the host for rollback.
- Never edit production files by hand without recording the change; the compose file on the server should match the repository's production version.

## 8. Checkpoint

Stage complete when: Docker and Compose are installed from the official source; log rotation is set; the compose file validates and shows only the proxy publishing ports; the env file exists on the server with restricted permissions and no secret has passed through chat or the repository; images are pinned and pulled; all containers are healthy; and the app answers on the server's local address. In guide mode, ask for the container status listing and the validated port list.
