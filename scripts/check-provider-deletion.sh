#!/usr/bin/env bash
# Deleting any one provider folder and its registry entry must leave the
# remaining tree typechecking with the full frontend and backend suites green.
set -euo pipefail
cd "$(dirname "$0")/.."
exec bun run scripts/provider-bundles.ts deletion
