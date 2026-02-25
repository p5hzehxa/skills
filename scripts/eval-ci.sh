#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/eval-ci.sh [--dry-run] [--product=<name>] [--lang=<lang>]
# Requires: ANTHROPIC_API_KEY env var (unless --dry-run)

# Check for --dry-run in args
is_dry_run=false
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    is_dry_run=true
    break
  fi
done

if [ "$is_dry_run" = false ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: ANTHROPIC_API_KEY not set"
  exit 1
fi

# Run with gates enabled
bun run scripts/eval.ts \
  --no-cache \
  --fail-on-regression \
  --report=both \
  "$@"
