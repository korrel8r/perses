#!/usr/bin/env bash
# Run a local Perses server that can load this checkout via `percli plugin start`.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
engine=${CONTAINER_ENGINE:-}
if [[ -z "$engine" ]]; then
  if command -v podman >/dev/null 2>&1; then
    engine=podman
  elif command -v docker >/dev/null 2>&1; then
    engine=docker
  else
    echo 'Install podman or docker, or set CONTAINER_ENGINE.' >&2
    exit 1
  fi
fi
if ! command -v "$engine" >/dev/null 2>&1; then
  echo "Container engine not found: $engine" >&2
  exit 1
fi

config_dir=$(mktemp -d)
cleanup() {
  if [[ -s "$config_dir/cid" ]]; then
    "$engine" rm -f "$(<"$config_dir/cid")" >/dev/null 2>&1 || true
  fi
  rm -rf "$config_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# The Perses image runs as a non-root user; make the config readable inside it.
chmod 755 "$config_dir"
cat > "$config_dir/config.yaml" <<'EOF'
plugin:
  enable_dev: true
security:
  enable_auth: false
database:
  file:
    folder: /tmp/perses-korrel8r-db
EOF
chmod 644 "$config_dir/config.yaml"

# The Perses image runs as 'nobody', which cannot read private checkout
# directories (e.g. schemas/ with mode 750). Stage readable schema files
# instead of changing permissions on the developer's working tree.
mkdir "$config_dir/plugin"
cp -R "$root/schemas" "$root/cue.mod" "$root/package.json" "$config_dir/plugin/"
chmod -R a+rX "$config_dir/plugin"

# percli registers localhost:<dev-port> and the absolute path to this checkout.
# Host networking and a same-path schema mount let the container reach both.
args=(run --rm --cidfile "$config_dir/cid" --name perses-korrel8r --network host
  -v "$config_dir/plugin:$root:ro"
  -v "$config_dir/config.yaml:/etc/perses/config.yaml:ro")
if [[ "$(basename "$engine")" == podman ]]; then
  # Avoid relabeling the working tree on SELinux-enabled hosts.
  args+=(--security-opt label=disable)
fi
image=${PERSES_IMAGE:-docker.io/persesdev/perses:v0.53.0-beta.3}
echo "Starting $image at http://localhost:8080 (Ctrl-C to stop)" >&2
"$engine" "${args[@]}" "$image" --config=/etc/perses/config.yaml --web.listen-address=127.0.0.1:8080 &
container_pid=$!
wait "$container_pid"
