# Verification, Rollback and Cleanup

Stage 6 and the report. The purpose is evidence: for each claim about the server, a check that was actually run. Mark each **verified** (a command ran and the output was seen) or **instructed** (the owner was told what to do and has not reported the result).

## Contents
1. Ground rules
2. Checks
3. Rollback
4. Operations and cost
5. Report template
6. The rule for saying "live and hardened"

## 1. Ground rules

- Run outside-in checks from a machine that is **not** the server (the owner's laptop), because checks on the server itself do not show what the internet sees.
- Remove secrets before pasting outputs; the skill needs the shape of the result, not the values.
- If a check cannot be run, mark it **instructed** and give the exact steps. Never write "passed" for something not seen.
- Re-run the security checks after any later change to SSH, firewall, or compose files.

## 2. Checks

**Access and SSH** (critical = C)
- C1. Root login over SSH is refused.
- C2. Password authentication is refused (a login forced to use a password fails).
- C3. The admin user logs in with a key and can use sudo as planned.
- C4. The effective SSH daemon configuration shows the intended values (read the effective config, not the file).
- C5. If a deploy key exists: it can run only the deploy script and cannot open a shell or forward ports.
- R1. Authentication attempts are being rate-limited or logged as planned.

**Network exposure**
- C6. An external scan of the droplet's address shows only the intended ports (SSH per policy, 80, 443) and nothing else.
- C7. The database and cache ports are not reachable externally.
- C8. The Cloud Firewall rules and host firewall rules match the plan.
- C9. Published ports in the resolved compose file are only the proxy's.

**Application**
- C10. All containers are running and healthy.
- C11. The app responds correctly over HTTPS on each planned hostname and HTTP redirects to HTTPS.
- C12. The certificate is valid, matches the hostname and its storage persists across a proxy restart.
- C13. The deployed images are the pinned tags or digests in the plan, not `latest`.
- C14. No secret appears in the repository, the image, container inspect output shared for review, or logs.
- R2. Logs are rotated and disk usage is sane.

**Persistence and recovery**
- C15. The server reboots and the whole stack returns without manual steps.
- C16. Data survives a container recreate (a test record persists).
- C17. A database backup ran on schedule, is stored off the droplet and a restore drill succeeded.
- C18. Rollback to the previous image tag works (section 3).
- R3. Monitoring and alerts (CPU, memory, disk, certificate expiry, backup failure) reach a human.
- R4. Automatic security updates are on and the reboot policy is understood.

**Cost and hygiene**
- R5. The billable resource list matches the plan; test resources are deleted.

## 3. Rollback

- Before each deploy, record the currently running image tags (and digests) and the previous compose file version. Keep the previous image on the host.
- Application rollback: set the previous tag, pull if needed, bring the stack up, run the health check. Practice this once before it is needed.
- Database rollback is not automatic. Migrations must be backward compatible; if a migration cannot be undone safely, the recovery path is restore from the pre-migration backup, which costs data written since. State this in the plan.
- Server-level rollback: restore from a snapshot taken before the change. Snapshots bill until deleted and restore the whole disk, including data created since.
- If access is lost after a hardening change: use the provider's web console or recovery options to repair the SSH configuration or firewall; confirm the owner has used it once.
- Decision owner: name who decides to roll back and how it is communicated.

## 4. Operations and cost

Give the owner a short operations sheet:
- Deploy a new tag; roll back; view logs; restart a service; where env files, compose files and backups are.
- Routine tasks: applying updates and reboots, rotating credentials, renewing nothing manually (with certificate expiry alerts), reviewing backups monthly and running the restore drill on schedule.
- Cost: list every billing item (droplet, backups, snapshots, block storage volumes, reserved IP, managed database, object storage, bandwidth overage). State plainly that **destroying a droplet does not stop billing for its snapshots, volumes, or reserved IPs** and give the cleanup order if the project is retired: export data, remove DNS, then delete resources and confirm the billing view.

## 5. Report template

Write `do-deployment-report.md`:

```
# DigitalOcean deployment report
Application: <name>    Date: <date>    Region: <...>    Droplet: <plan, image>
Domain(s): <...>       Database: <managed | container, engine/version>

## Verdict
<Live and hardened | Not yet> — one-sentence reason.
Blocking items: <list, or none>

## Results
| ID | Check | How performed | Result | Status |
| C1 | Root SSH refused | ssh attempt from laptop, output pasted | refused | verified / instructed |
... one row per check ...

## Decisions still unresolved
<from the plan's decisions table>

## Not verified here
<each item, why and the steps to verify>

## Findings
<severity, location, what is wrong, fix>

## Handoff
Operations sheet: <link/section>    CI/CD checklist: <deploy user, key, host fingerprint, script path, registry credential, health URL>
Cost items and cleanup notes: <...>
```

## 6. The rule for saying "live and hardened"

The verdict may be **Live and hardened** only if every critical check (C1–C18) is **verified**, no finding above low severity is open, the restore drill has succeeded and the plan's decisions are resolved. If any critical check is instructed-only, failed, or unresolved, the verdict is **Not yet**, naming the blockers and the exposure in plain terms (for example, "the database backup has never been restored, so recovery is unproven"). Do not soften this to meet a launch date.
