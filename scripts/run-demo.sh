#!/usr/bin/env bash
# Start a local Perses demo, provision Korrel8r resources, and open the dashboard.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
: "${KORREL8R_URL:?Set KORREL8R_URL to the Korrel8r server base URL (without /api/v1alpha1)}"
command -v oc >/dev/null || { echo 'Install oc and log in to the cluster first.' >&2; exit 1; }
logs=$(mktemp -d)
perses_pid=
plugin_pid=
tail_pid=
# Called by the EXIT trap; ShellCheck cannot trace that indirect call.
# shellcheck disable=SC2317
cleanup() {
  for pid in "$tail_pid" "$plugin_pid" "$perses_pid"; do
    if [[ -n "$pid" ]]; then kill -TERM "$pid" 2>/dev/null || true; fi
  done
  for pid in "$tail_pid" "$plugin_pid" "$perses_pid"; do
    if [[ -n "$pid" ]]; then wait "$pid" 2>/dev/null || true; fi
  done
  rm -rf "$logs"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# DEMO ONLY: skipping TLS verification while sending a bearer token is unsafe.
# Never reuse this Secret or TLS setting in production; configure the ingress CA instead.
echo 'WARNING: Dummy Korrel8r proxy and preflight skip TLS certificate verification (demo only).' >&2
# Catch an unavailable/wrong OpenShift route before starting Perses. Use the
# same token and (demo-only) TLS policy as the configured Perses HTTP proxy.
api_url=$(node -e '
const base = new URL(process.env.KORREL8R_URL);
if (!["http:", "https:"].includes(base.protocol) || base.pathname.replace(/\/+$/, "").endsWith("/api/v1alpha1")) {
  throw new Error("KORREL8R_URL must be an http(s) server base URL without /api/v1alpha1");
}
console.log(`${base.href.replace(/\/+$/, "")}/api/v1alpha1`);
')
token=$(oc whoami -t)
[[ -n "$token" ]] || { echo 'oc returned an empty bearer token.' >&2; exit 1; }
# Pass the token on stdin, not the command line. Never display the response body
# (it may contain credentials or other sensitive server details).
status=$(printf 'header = "Authorization: Bearer %s"\n' "$token" | curl -ksS --connect-timeout 5 --max-time 20 \
  --config - -o "$logs/korrel8r-response" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data '{"start":{"queries":["k8s:ConfigMap:{}"]},"depth":0}' \
  "$api_url/graphs/neighbors?rules=true") || status=000
if [[ "$status" == 503 ]]; then
  echo "Korrel8r route returned HTTP 503 at $api_url/graphs/neighbors." >&2
  echo 'OpenShift says the application is not available. Check KORREL8R_URL and the route, service endpoints and pods; this is not a Perses rendering error.' >&2
  exit 1
elif [[ "$status" == 000 ]]; then
  echo "Cannot reach Korrel8r at $api_url (check KORREL8R_URL and network access)." >&2
  exit 1
elif [[ "$status" != 2?? ]]; then
  echo "Korrel8r preflight returned HTTP $status at $api_url/graphs/neighbors (check URL, token and server logs)." >&2
  exit 1
fi

url=http://localhost:8080
if curl -fsS --max-time 2 "$url/api/v1/plugins" >/dev/null 2>&1; then
  echo "Perses is already running at $url; stop it before running the demo." >&2
  exit 1
fi

"$root/scripts/start-local-perses.sh" >"$logs/perses.log" 2>&1 & perses_pid=$!
echo "Starting Perses; waiting for $url ..."
ready=
for ((i=0; i<120; i++)); do
  if curl -fsS --max-time 2 "$url/api/v1/plugins" >/dev/null 2>&1; then
    ready=yes
    break
  fi
  kill -0 "$perses_pid" 2>/dev/null || break
  sleep 1
done
if [[ "$ready" != yes ]]; then
  echo 'Perses failed to start:' >&2
  tail -30 "$logs/perses.log" >&2
  exit 1
fi

KORREL8R_DEV_CONFIG=demo/rsbuild.config.ts "$root/scripts/start-plugin-dev.sh" >"$logs/plugin.log" 2>&1 & plugin_pid=$!
echo 'Waiting for Korrel8rGraphPanel to register ...'
ready=
for ((i=0; i<120; i++)); do
  if curl -fsS --max-time 2 "$url/api/v1/plugins" 2>/dev/null | grep -q 'Korrel8rGraphPanel'; then
    ready=yes
    break
  fi
  kill -0 "$plugin_pid" 2>/dev/null || break
  kill -0 "$perses_pid" 2>/dev/null || break
  sleep 1
done
if [[ "$ready" != yes ]]; then
  echo 'Plugin registration failed:' >&2
  tail -30 "$logs/perses.log" "$logs/plugin.log" >&2
  exit 1
fi

percli apply -f "$root/testdata/perses/dummy-project.json"
# Feed the token over stdin: never put it in an argument, a file, or a log.
printf '%s' "$token" | node -e '
let credentials = "";
process.stdin.on("data", (chunk) => { credentials += chunk; });
process.stdin.on("end", () => {
  console.log(JSON.stringify({
    kind: "Secret",
    metadata: { project: "Dummy", name: "Korrel8rAuth" },
    spec: {
      authorization: { type: "Bearer", credentials },
      tlsConfig: { insecureSkipVerify: true }, // DEMO ONLY; replace with the trusted ingress CA.
    },
  }));
});
' | percli apply -f -
unset token

# Node builds the JSON so special characters in the URL cannot break quoting.
export KORREL8R_API_URL="$api_url"
node - <<'NODE' | percli apply -f -
const url = process.env.KORREL8R_API_URL;
console.log(JSON.stringify({
  kind: 'Datasource',
  metadata: { name: 'Dummy', project: 'Dummy' },
  spec: {
    default: true,
    plugin: {
      kind: 'Korrel8rDatasource',
      spec: {
        proxy: {
          kind: 'HTTPProxy',
          spec: {
            url,
            secret: 'Korrel8rAuth',
            allowedEndpoints: [
              { endpointPattern: '/graphs/neighbors', method: 'POST' },
              { endpointPattern: '/graphs/goals', method: 'POST' },
            ],
          },
        },
      },
    },
  },
}));
NODE
percli apply -f "$root/testdata/perses/dummy-dashboard.json"

dashboard_url=http://localhost:8080/projects/Dummy/dashboards/Dummy
echo "Korrel8rPerses demo is available at $dashboard_url (Ctrl-C to stop both servers)."
echo "Logs: $logs/{perses,plugin}.log"
tail -n +1 -F "$logs/perses.log" "$logs/plugin.log" & tail_pid=$!
if [[ "${OPEN_BROWSER:-1}" != 0 ]]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$dashboard_url" || echo "Could not open a browser automatically; visit $dashboard_url manually." >&2
  else
    echo "xdg-open is unavailable; visit $dashboard_url manually." >&2
  fi
fi
# Keep both servers alive until either exits; the EXIT trap stops the other.
if wait -n "$perses_pid" "$plugin_pid"; then
  echo 'A demo server exited.' >&2
else
  echo 'A demo server failed.' >&2
fi
exit 1
