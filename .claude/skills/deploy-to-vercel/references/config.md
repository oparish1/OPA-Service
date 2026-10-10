# Build and output configuration

## Prefer auto-detection
Vercel detects the framework from `package.json` and config files. Only add `vercel.json` to change behavior. Check current schema at https://vercel.com/docs/project-configuration before adding fields.

## Common settings (dashboard or `vercel.json`)
| Setting | Notes |
|---|---|
| Framework preset | Override only if detection is wrong |
| Root Directory | Required for monorepos; point at the app folder |
| Build command | Defaults per framework; override if the app needs a workspace-aware command (e.g. build a shared package first) |
| Output directory | Vite: `dist`. CRA: `build`. Next.js manages its own; don't set |
| Install command | Override for workspaces or private registries |
| Node.js version | Set in project settings or `engines.node` in `package.json`; match local |

## Framework notes
- **Next.js:** no output directory setting. `NEXT_PUBLIC_*` is exposed to the browser. API routes and server components become serverless/edge functions automatically.
- **Vite / React SPA:** static output in `dist`. Client-side routing needs a rewrite so deep links return `index.html`:
  `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
  Only `VITE_*` vars reach the client.
- **Astro / SvelteKit / Nuxt / Remix:** each needs its Vercel adapter for SSR. Static output works without one. Check the framework's Vercel guide.

## Monorepos
- Set Root Directory to the app path.
- Enable "include files outside the root directory" if the app imports from sibling packages.
- Use `ignoreCommand` (e.g. `git diff --quiet HEAD^ HEAD -- .`) to skip builds when the app didn't change.
- Turborepo/Nx: Vercel detects them; make sure the build command builds dependencies first.

## Functions
Region and max duration are configurable in `vercel.json` under `functions`. Defaults and limits depend on the plan, so check the current docs rather than assuming.
