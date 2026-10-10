#!/usr/bin/env bash
# Preflight for deploy-to-vercel. Read-only: prints facts, never env values or tokens.
# Usage: scripts/preflight.sh [app_dir]   (default: current dir)
set -u
APP="${1:-.}"
cd "$APP" || { echo "FAIL: cannot cd to $APP"; exit 2; }
fail=0
ok()   { echo "OK    $*"; }
warn() { echo "WARN  $*"; }
bad()  { echo "FAIL  $*"; fail=1; }

[ -f package.json ] || { bad "no package.json in $(pwd) - wrong directory or not a JS/TS app"; exit 1; }

# Package manager from lockfile
pm=""; cmd_install=""
if   [ -f pnpm-lock.yaml ];   then pm=pnpm; cmd_install="pnpm install --frozen-lockfile"
elif [ -f yarn.lock ];        then pm=yarn; cmd_install="yarn install --frozen-lockfile"
elif [ -f bun.lockb ] || [ -f bun.lock ]; then pm=bun; cmd_install="bun install --frozen-lockfile"
elif [ -f package-lock.json ]; then pm=npm;  cmd_install="npm ci"
fi
if [ -n "$pm" ]; then ok "package manager: $pm (install: $cmd_install)"; else warn "no lockfile - Vercel installs will be unpinned"; fi

# Framework hint (first match wins)
fw=unknown
for pair in next:Next.js astro:Astro nuxt:Nuxt "@sveltejs/kit:SvelteKit" "@remix-run/react:Remix" vite:Vite react-scripts:CRA; do
  dep="${pair%%:*}"; name="${pair#*:}"
  if grep -Eq "\"$dep\"[[:space:]]*:" package.json; then fw="$name"; break; fi
done
echo "INFO  framework hint: $fw"

# Build script and Node version
if grep -Eq '"build"[[:space:]]*:' package.json; then ok "package.json has a build script"; else bad "no build script in package.json"; fi
node_req=$(grep -E '"node"[[:space:]]*:' package.json | head -1 | sed -E 's/.*"node"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')
[ -n "$node_req" ] && echo "INFO  engines.node: $node_req" || warn "no engines.node; Vercel will use its default Node version"
command -v node >/dev/null && echo "INFO  local node: $(node -v)"

# Monorepo signals
for f in pnpm-workspace.yaml turbo.json nx.json lerna.json; do [ -f "../$f" ] || [ -f "$f" ] && echo "INFO  monorepo signal: $f (set Vercel Root Directory to this app)"; done

# Vercel linkage (names only, no IDs dumped)
[ -f vercel.json ] && echo "INFO  vercel.json present" || echo "INFO  no vercel.json (auto-detection will be used)"
if [ -f .vercel/project.json ]; then ok "already linked (.vercel/project.json exists)"; else echo "INFO  not linked yet"; fi

# CLI + auth
if command -v vercel >/dev/null 2>&1; then
  ok "vercel CLI: $(vercel --version 2>/dev/null | head -1)"
  if vercel whoami >/dev/null 2>&1; then ok "authenticated: $(vercel whoami 2>/dev/null | tail -1)"; else warn "not authenticated - run 'vercel login' or set VERCEL_TOKEN"; fi
else
  warn "vercel CLI not found - install with: npm i -g vercel (or use Git integration)"
fi

# .env files must not be committed
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked=$(git ls-files | grep -E '(^|/)\.env(\.[^/]*)?$' | grep -Ev '\.(example|sample|template)$' || true)
  [ -n "$tracked" ] && bad "committed env file(s): $(echo "$tracked" | tr '\n' ' ') - remove from git and rotate any secrets"
  git remote get-url origin >/dev/null 2>&1 && ok "git remote 'origin' set (Git integration possible)" || warn "no git remote (Git integration needs a hosted repo)"
fi

echo; [ $fail -eq 0 ] && echo "PREFLIGHT PASSED (build not run - run it via the project's own build command)" || echo "PREFLIGHT FAILED"
exit $fail
