#!/usr/bin/env bash
# Register this checkout as a development plugin with a running Perses server.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
if ! command -v percli >/dev/null 2>&1; then
  echo 'percli is required; see README.md for installation instructions.' >&2
  exit 1
fi
cd "$root"
if [[ ! -x node_modules/.bin/rsbuild ]]; then
  echo 'Installing npm dependencies (npm ci)...' >&2
  npm ci
fi
url=${PERSES_URL:-http://localhost:8080}
percli login "$url"
echo "Registering Korrel8rPerses with $url (Ctrl-C to stop)" >&2
percli plugin start "$root" &
cli_pid=$!
cleanup() {
  kill -TERM "$cli_pid" 2>/dev/null || true
  wait "$cli_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
wait "$cli_pid"
