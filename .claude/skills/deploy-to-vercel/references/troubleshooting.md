# Build and deploy troubleshooting

Read the build log first: `vercel inspect <url> --logs` or the dashboard. Fix the first error, not the last.

| Symptom | Likely cause | Fix |
|---|---|---|
| Works locally, fails on Vercel | Node version mismatch | Set Node version in project settings or `engines.node` |
| `Module not found` for a path that exists | Case-sensitive Linux filesystem | Fix the import casing to match the file |
| Build fails on env var undefined | Var only set locally | Add it for the right environment, redeploy |
| Client shows `undefined` for a var | Missing public prefix, or added after the build | Use `NEXT_PUBLIC_`/`VITE_` etc., then redeploy |
| Install fails | Missing/stale lockfile, private registry | Commit the lockfile; add registry auth as env var |
| Monorepo: package not found | Root Directory excludes sibling packages | Enable including files outside root; build deps first |
| 404 on deep links (SPA) | No rewrite to `index.html` | Add the rewrite in `vercel.json` |
| 401 on preview URL | Deployment Protection | Expected; use the protected-share link or bypass token |
| Deploy READY but app errors | Runtime env var or function region/timeout | Check `vercel logs`, function config |
| Build skipped | `ignoreCommand` returned 0 | Review the ignore rule |
