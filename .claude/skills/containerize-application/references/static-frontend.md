# Static and SPA Frontends

For sites built to static files (Vite, Create React App, Angular, Vue CLI, Astro static, Hugo/Jekyll) and served by a web server. Server-rendered frameworks that run a Node process use `node.md`.

## Contents
1. What to read in the project
2. Pattern
3. Web server configuration
4. Configuration at run time
5. Pitfalls

## 1. What to read in the project

- The build command and the output directory (`dist`, `build`, `out`, `public`); read the config, do not assume.
- Whether it is a single-page app using client-side routing (needs a fallback to `index.html`) or a multi-page static site.
- The public base path if the app is not served from `/`.
- Where the API lives: same origin behind a proxy, or a separate domain (CORS) and how the front end learns its URL.
- Build-time environment variables (`VITE_*`, `REACT_APP_*`, `NEXT_PUBLIC_*` and similar).

## 2. Pattern

Two stages: a build stage (Node or the site generator's image, dependencies from the lockfile, then the build) and a runtime stage that contains a web server and only the built output.

- Web server for the final stage: an unprivileged nginx image (runs as non-root and listens on a high port such as 8080), or Caddy, or another static server. Look up and pin the current version.
- Copy only the build output directory into the server's document root. No `node_modules`, source, or toolchain in the final image.
- Non-root, with the listen port above 1024 so no capability is needed.
- Health check: the server's own binary or a tiny request to `/` (or a dedicated health path), using tools present in the image.

## 3. Web server configuration

Provide a config file, copied in, that:
- Serves `index.html` for unknown paths (SPA fallback) but returns real 404s for missing static assets and API paths.
- Sets long-lived, immutable caching for content-hashed asset files and no-cache (or short revalidation) for `index.html` so deploys take effect.
- Enables compression (gzip and brotli or zstd where the server supports it).
- Sets baseline security headers appropriate to the app (content type options, frame protection, referrer policy and a Content-Security-Policy the owner reviews; do not invent a CSP that breaks the app).
- Does not expose directory listings or dotfiles.
- If it proxies `/api` to a backend, uses the compose service name and sets timeouts.

## 4. Configuration at run time

Values inlined at build time are baked into the JavaScript and visible to everyone; never put secrets in them and remember that changing them requires a rebuild. If one image must serve several environments, offer one of these and ask which:
- Generate a small `config.js` or JSON at container start from environment variables, loaded by the app before it boots (the app must read it).
- Use relative URLs and let a reverse proxy route `/api`, so no per-environment URL is needed.

## 5. Pitfalls

- SPA fallback swallowing missing assets and API 404s, so errors look like a blank page.
- Caching `index.html` forever.
- Forgetting the base path, breaking asset URLs behind a sub-path.
- Running the stock nginx image as root on port 80 in a hardened environment.
- Baking an API token into the bundle.
- Copying the entire repo into the final stage instead of the output directory.
