#!/usr/bin/env bash
# Install the upstream Korrel8r CLI into a temporary directory and exercise
# the datasource client against its real REST server with local mock-store data.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
workdir=$(mktemp -d)
pid=
cleanup() {
  if [[ -n "$pid" ]]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -rf "$workdir"
}
trap cleanup EXIT

mkdir -p "$workdir/bin"
GOBIN="$workdir/bin" go install github.com/korrel8r/korrel8r/cmd/korrel8r@latest
port=$(node -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')
export KORREL8R_TEST_URL="http://127.0.0.1:$port/api/v1alpha1"
# Korrel8r resolves mockData relative to the server working directory.
(cd "$root/testdata/korrel8r" && exec "$workdir/bin/korrel8r" -c korrel8r.yaml web --http "127.0.0.1:$port" --unsafe-shared-session) >"$workdir/server.log" 2>&1 &
pid=$!
for ((i=0; i<100; i++)); do
  if curl -fsS "$KORREL8R_TEST_URL/domains" > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo 'Korrel8r exited during startup:' >&2
    cat "$workdir/server.log" >&2
    exit 1
  fi
  sleep 0.1
done
if ! curl -fsS "$KORREL8R_TEST_URL/domains" > /dev/null; then
  echo 'Korrel8r failed to start:' >&2
  cat "$workdir/server.log" >&2
  exit 1
fi
(cd "$root" && npm test -- --runInBand --runTestsByPath src/datasources/korrel8r-datasource/Korrel8rDatasource.integration.test.ts)
