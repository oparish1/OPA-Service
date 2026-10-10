# Database Setup and Backups

Stage 3. The database is the part you cannot rebuild from the repository. Decide the topology deliberately, keep it off the internet, and prove restores work.

## Contents
1. Decide first
2. Option A: managed database
3. Option B: database container on the droplet
4. Connection and secrets
5. Migrations
6. Backups
7. The restore drill
8. Checkpoint

## 1. Decide first (owner commitments)

- Managed database or container on the droplet. Present the trade-off plainly: a managed service costs more but provides automated backups, patching, and failover options; a container is cheaper and simpler but the owner owns backups, upgrades, and recovery.
- Engine and major version, matching the application's tested version.
- Recovery objectives: how much data loss (time since last backup) and how much downtime the business tolerates.
- Backup retention, encryption, and where copies live (off the droplet, ideally in a different failure domain).
- Data sensitivity and any regulatory constraints on location or retention.

## 2. Option A: managed database

- Look up DigitalOcean's currently offered engines, plans, and features (backups, point-in-time recovery, standby nodes) and their retention; do not assume.
- Create it in the same region and VPC as the droplet so traffic stays on the private network.
- Restrict access to trusted sources: allow only the droplet (by name or tag) and, if needed, specific admin addresses. Do not leave the database open to all addresses.
- Require TLS for connections; give the application the provider's connection details and CA certificate as the driver requires.
- Create a dedicated application user and database instead of using the default administrative credentials, with the least privileges the app needs; a separate role runs migrations if the owner wants that separation.
- Confirm automated backups are on and read the retention; add off-platform logical backups if the owner's recovery objectives or independence requirements exceed the provider's.

## 3. Option B: database container on the droplet

- Pin the image to an exact version and major version; document how a major upgrade will be done (typically dump and restore, not an in-place image swap).
- Store data in a **named volume** (or a mounted block storage volume for size and portability). Never rely on the container's writable layer.
- **Never publish the database port.** The app reaches it over the compose network by service name. Confirm no `ports:` entry exists for it in the production file and that the external port check finds nothing.
- Health check the database with its native readiness tool; make the app wait on that health status.
- Set memory-related settings appropriate to the droplet size; an out-of-memory kill of the database is a common failure on small servers.
- Passwords come from the server-side env file or secret files; the database is initialized with them on first start, and the initialization variables only apply to an empty data directory.
- Plan disk growth and monitor disk usage with alerts.

## 4. Connection and secrets

- Connection strings and credentials live only in the server-side env file or secret files with restricted permissions. Names are listed in the plan; values never appear in chat, the repository, or logs.
- Use distinct credentials per environment.
- Rotate credentials on a schedule the owner sets and after any suspected exposure; document the procedure and who performs it.

## 5. Migrations

- Run migrations as a deliberate one-off step (a job using the same image with a different command), not implicitly on every start of every replica.
- Make each release's migrations backward compatible with the previous release, so rollback of the application does not meet a schema it cannot read.
- Back up (or snapshot) immediately before risky migrations, and record the tag and time.
- Destructive operations (dropping columns or tables) happen in a later release after the code no longer uses them.

## 6. Backups

Droplet backups and snapshots capture the disk at a moment in time; for a running database they are crash-consistent at best and can restore an inconsistent state. Treat them as a convenience for the server, not as the database backup.

A database backup plan has these parts, each agreed with the owner:
- **Method:** a logical dump with the engine's native tool (or continuous archiving for point-in-time recovery if the objective needs it), taken on a schedule set by the data-loss tolerance. For managed databases, use the provider's automated backups and add independent dumps if wanted.
- **Destination:** off the droplet, in separate storage (for example object storage or another provider), with credentials limited to write/append and lifecycle rules for retention. The credentials for that storage are secrets held on the server, not in the repository.
- **Encryption:** encrypt backups at rest and in transit; store the encryption key separately from the backups.
- **Schedule and execution:** a scheduled job (systemd timer or cron) run by a non-root user, with logging, and a failure alert: a backup that silently stops is worse than none.
- **Retention:** how many daily, weekly, and monthly copies, set by the owner.
- **Integrity:** verify each backup finished and is non-trivially sized; periodically verify contents.

## 7. The restore drill

A backup that has never been restored is unproven. Before calling the deployment done:
1. Restore the latest backup into a **separate, disposable** database (a scratch container or a temporary managed instance), never over production.
2. Run the application's basic checks or a set of row-count and integrity queries against it.
3. Record how long it took and the steps, which become the recovery runbook and show whether the recovery objective is achievable.
4. Delete the scratch resources and confirm nothing lingering keeps billing.
5. Repeat on a schedule the owner sets (for example quarterly) and after major changes.

## 8. Checkpoint

Stage complete when: the database topology matches the plan; the database is unreachable from the internet (confirmed by an external check); the app connects with a dedicated least-privilege user over the private path with TLS where applicable; credentials exist only on the server; backups run on schedule to off-droplet storage with an alert on failure; and a restore drill succeeded with the time recorded. In guide mode, ask for the backup job's last run output and the restore drill notes.
