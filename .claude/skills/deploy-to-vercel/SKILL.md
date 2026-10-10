---
name: deploy-to-vercel
description: Deploy a frontend or full-stack JS/TS app (Next.js, React, Vite, Astro, SvelteKit, Nuxt, Remix, etc.) to Vercel - project linking, environment variables, build/output configuration, custom domains, and the deploy itself via CLI or Git integration. Use this whenever the user says "deploy to Vercel", "ship this to Vercel", "set up a Vercel project", "get this live on Vercel", "add a custom domain on Vercel", "push env vars to Vercel", or asks why a Vercel build or deployment is failing, even if they don't name the CLI or Git integration. Requires the app to build locally first. Runs the prime-codebase skill before touching any live deployment.
---

# Deploy to Vercel

Get an app live on Vercel safely: confirm what the project is, prove it builds, deploy a preview, verify it, and only then promote to production. Production deploys, env var writes and domain changes are public or hard-to-reverse writes, so each one needs the user's explicit go-ahead.

## Ground rules

- **Never print secrets.** Command output and transcripts are retained. Do not `cat` `.env*` files, echo tokens, or run `vercel env pull` and then display the file. Show env var *names*, never values. When you must pass a value, pipe it from the user's own source rather than typing it into a command line.
- **Exit 0 is not proof.** After every write (link, env add, deploy, domain add), read the state back and check it (`vercel inspect`, `vercel env ls`, `vercel domains inspect`). A deploy that returns a URL can still be in `ERROR` or `CANCELED` state.
- **Preview before production.** Never run `--prod` (or promote) on a first pass. Ask for confirmation, naming the project and target.
- **Don't guess the project.** If linking is ambiguous (several Vercel projects, a monorepo, an existing `.vercel/`), stop and ask which one.
- Prefer the current CLI's own help (`vercel --help`, `vercel <cmd> --help`) over memory when a flag is in doubt; the CLI changes.

## Bundled resources

| Path | Use it for |
|---|---|
| `scripts/preflight.sh [app_dir]` | Read-only check of package manager, framework hint, build script, Node version, monorepo signals, link state, CLI + auth, committed `.env` files. Run in Step 1. |
| `scripts/env_diff.py [app_dir]` | Compares env var **names** the code reads against names on Vercel (via `vercel env ls`, or `--vercel-names file`). Flags secrets behind public prefixes. Run in Step 6. |
| `assets/vercel.spa.json` | Rewrite so SPA deep links return `index.html` (Vite/CRA). |
| `assets/vercel.monorepo.json` | Starter `ignoreCommand` / install / build overrides for a monorepo app. Edit placeholders. |
| `assets/deploy-report.md` | Template for the final report. |
| `references/config.md` | Framework, monorepo, functions settings. Read in Step 5. |
| `references/domains.md` | DNS records and verification. Read in Step 9. |
| `references/troubleshooting.md` | Symptom-to-fix table for failed builds. Read when a build or deploy fails. |

Scripts print facts and never env values. Treat their output as evidence, then confirm anything surprising with the user.

## Step 1: Prime the codebase

Run the `prime-codebase` skill first, then `scripts/preflight.sh` from the app directory to check the mechanical facts. From its findings, establish and state back to the user:

| Fact | Why it matters |
|---|---|
| Framework and version | Vercel auto-detects presets; a wrong preset gives a wrong build/output |
| Package manager and lockfile | Vercel picks the installer from the lockfile; a missing lockfile means unpinned installs |
| Monorepo layout and the app's root directory | The Vercel *Root Directory* must point at the app, not the repo root |
| Build command, output directory, Node version | Must match what works locally |
| Env var **names** the app reads | Compare against what Vercel already has; never read values |
| Client vs server vars | Browser-exposed prefixes (`NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, etc.) are baked into the bundle and are public |
| Existing `.vercel/`, `vercel.json`, or Git remote | Tells you whether the project is already linked |

If `prime-codebase` is not available, gather the same facts by reading `package.json`, lockfiles, framework config, `vercel.json`, and grepping for `process.env` / `import.meta.env` usage.

## Step 2: Prove the local build

Vercel cannot fix an app that doesn't build. Run the project's real build command (from `package.json` scripts, using the project's package manager and a frozen/locked install) and confirm exit 0 and that the expected output directory exists.

If it fails, **stop and fix or report that first**; do not deploy hoping the remote environment differs. Common causes that only differ remotely are listed in `references/troubleshooting.md`: Node version mismatch, case-sensitive paths, missing env vars at build time, and dev-only dependencies.

## Step 3: Choose the deploy path

Ask the user, or infer from the repo, then confirm:

- **Git integration (recommended for ongoing work).** Every push builds a preview; the production branch builds production. Best when the code is on GitHub/GitLab/Bitbucket and the team wants PR previews.
- **CLI (good for first deploys, no remote, or CI control).** `vercel` from the machine or CI. Best when the repo isn't hosted yet or the user wants a one-off.

Do not mix them without saying so: CLI deploys and Git deploys both appear in the same project, and it confuses "what is live".

## Step 4: Link the project

Check first: `ls .vercel/project.json` (report only that it exists and the project name; the file holds IDs, not secrets, but don't dump the whole thing needlessly).

- **CLI:** confirm auth with `vercel whoami`, then `vercel link`. For monorepos run it from the repo root and set the Root Directory when prompted, or link from the app directory if the project is configured that way. Verify with `vercel project ls` or `vercel inspect` after.
- **Git integration:** the user imports the repo in the Vercel dashboard (or `vercel git connect` from a linked project). Confirm the Root Directory, framework preset, and production branch match Step 1. Walk the user through this; you cannot click the dashboard.
- **CI/headless:** use `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` from the environment. Never write them to files that get committed.

## Step 5: Configure build and output

Only add `vercel.json` when auto-detection is wrong or extra behavior is needed. Fewer overrides means fewer surprises. Start from `assets/vercel.spa.json` or `assets/vercel.monorepo.json` when they fit. See `references/config.md` for framework notes, monorepo settings, redirects/rewrites, function region and duration, and `ignoreCommand`.

If you override `buildCommand`, `outputDirectory` or `installCommand`, say why, and confirm they match Step 2.

## Step 6: Environment variables

1. Run `python3 scripts/env_diff.py <app_dir>`. It lists what Vercel already has (`vercel env ls`, names only) and diffs it against the names the code reads.
2. Report: missing, present, and present-but-unused, plus any public-prefix secret warning.
3. For each missing one, ask the user which environments it belongs to (Development / Preview / Production) and whether it is sensitive. Add with `vercel env add NAME <environment>`, letting the user supply the value at the prompt or piping it from their own secret source. Mark sensitive values as sensitive so they can't be read back.
4. Client-exposed prefixes are public. Refuse to put a secret behind one, and tell the user why.
5. Env vars are captured **at build time** for client bundles. Changing one requires a redeploy to take effect.
6. Verify with `vercel env ls` (names only).

## Step 7: Deploy a preview and verify

- **Git:** push a branch (or open a PR) and read the deployment status from the dashboard or `vercel ls`.
- **CLI:** run `vercel` (no `--prod`). To build locally with the project's remote settings, use `vercel pull` then `vercel build` then `vercel deploy --prebuilt`.

Then verify, do not assume:

1. `vercel inspect <deployment-url>` and confirm state is `READY`.
2. Fetch the URL (`curl -sI`) and confirm a 2xx/3xx response. Note that preview deployments may sit behind Vercel Authentication and return 401 to unauthenticated requests; that is protection working, not a failure.
3. If it failed, read the build log (`vercel inspect <url> --logs` or `vercel logs <url>`), fix the cause, and redeploy. See `references/troubleshooting.md`.

## Step 8: Promote to production

Ask for explicit confirmation: "Deploy `<project>` to production from `<branch/commit>`?" Only then:

- **Git:** merge to the production branch, or `vercel promote <preview-url>` to promote an already-verified preview.
- **CLI:** `vercel --prod`.

Prefer promoting the verified preview over rebuilding, so what was tested is what ships. Read back the production deployment state and URL afterwards.

## Step 9: Custom domains (last, and only if asked)

Domains change live traffic and DNS, so do this after production is healthy. See `references/domains.md`.

1. `vercel domains add <domain> <project>` (or dashboard).
2. Tell the user exactly which DNS records to set at their registrar (typically an `A` record for the apex and a `CNAME` for `www` or subdomains; use the values Vercel reports for the project, not remembered ones).
3. Do not claim the domain works until `vercel domains inspect <domain>` (or the dashboard) shows it verified and the HTTPS URL responds. DNS propagation can take time; say so.

## Final report

End with a short summary, using `assets/deploy-report.md` as the template:

- Project and scope linked, framework and root directory
- Deploy path used (Git or CLI)
- Env var **names** added or found missing (never values)
- Preview URL and its verified state; production URL and state if promoted
- Domains configured and their verification status
- Anything left for the user (DNS records, dashboard steps, secrets to supply)

## When to stop and ask

- The local build fails.
- More than one plausible Vercel project or scope.
- A secret would be exposed through a public env prefix.
- A monorepo Root Directory can't be determined.
- The user hasn't confirmed a production deploy or domain change.
