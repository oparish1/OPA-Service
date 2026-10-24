#!/usr/bin/env bash
# Copying core/, shared/, one provider folder and the registry file listing only
# that provider into a fresh checkout must typecheck.
set -euo pipefail
cd "$(dirname "$0")/.."
exec bun run scripts/provider-bundles.ts reuse
