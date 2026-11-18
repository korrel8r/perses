# Korrel8r Perses plugins

Perses plugin-module for a **Korrel8rDatasource** and a **Korrel8rGraphPanel** .

This repository is intended to resolve implementation questions before contributing the code to https://github.com/perses/plugins

Repository layout generated with `percli plugin generate` from https://github.com/perses/perses

## Status

**Datasource — prototype with security issues:** supports direct or Perses-proxied requests to Korrel8r `POST /graphs/neighbors` and `POST /graphs/goals` at the `/api/v1alpha1` API root.

The local demo uses an `oc whoami -t` user token in a Perses Secret, an unauthenticated Perses server with its default encryption key, and `tlsConfig.insecureSkipVerify: true` (no upstream certificate verification). **Do not use the demo authentication or TLS configuration in production.** The client has direct-HTTP integration tests, but proxy authentication, token lifecycle, CORS and the full API response types still need verification.

**Panel — graph rendering placeholder:** the custom Query tab configures neighbor or goal requests, which use the Perses dashboard time range and an optional result limit. Neighbor depth is optional too: blank leaves the default to Korrel8r, and 0 returns only the start query results. `toTopologyGraph` maps the response to a placeholder static SVG graph: nodes sit on a ring that grows with the node count, and long class names are shortened. There is no interaction, and layout, navigation and accessibility need substantial work. The full response and errors are available as JSON.

**Next steps:** see TODO section below

## Demo

On Linux, install Podman (or Docker), `percli`, `oc`, and `curl`; log in with `oc login` and have a Korrel8r server running. From this checkout, set its **base URL** (without `/api/v1alpha1`) and run:

```sh
export KORREL8R_URL=http://127.0.0.1:8081 # replace with your Korrel8r URL
./scripts/run-demo.sh
```

The script starts local Perses and the plugin, provisions the **Dummy** project, proxy datasource and dashboard, then opens <http://localhost:8080/projects/Dummy/dashboards/Dummy> and follows the logs. If the browser does not open, visit the URL yourself; set `OPEN_BROWSER=0` for headless use. Press Ctrl-C to stop the demo (its data is ephemeral). It does **not** start Korrel8r. The Perses server must be able to reach `KORREL8R_URL`; it shares the host network, so a Korrel8r server on host loopback is reachable.

The Dummy panel starts with neighbor query `k8s:Pod:{}` at depth 1. To edit it, click dashboard **Edit**, then the **pencil** in the panel header; use the panel's **Query** tab to set a query and choose **Neighbors** (depth) or **Goals** (goal class names). Click **Apply**, then dashboard **Save**. The graph follows the dashboard time range; expand **Full Korrel8r JSON response** to inspect the result. The **Settings** tab selects a nondefault datasource if needed.

**Security: local demo only.** Provisioning uses an `oc whoami -t` bearer token in a Perses Secret and disables upstream TLS certificate verification (`tlsConfig.insecureSkipVerify: true`). Perses is unauthenticated, uses its default encryption key, and binds to `127.0.0.1:8080`; do not expose it on a shared network or reuse this configuration in production. See the TODO for production authentication and CA trust.

The script uses Podman when available (or Docker; set `CONTAINER_ENGINE=docker` to force it). Set `PERSES_IMAGE` to select a matching Perses image. Plugin TypeScript hot-reloads; schema changes require restarting the demo because Perses mounts a snapshot of the schemas. For other dashboards, configure a **Korrel8r Datasource** at the `/api/v1alpha1` API root and add a **Korrel8r Graph Panel**; direct browser connections require CORS, while the HTTP proxy does not. Saved plugin kinds remain `Korrel8rDatasource` and `Korrel8rGraphPanel`.

## Development

This is a TypeScript/React plugin, not a Go application. The `cue.mod/` directory holds the CUE schema module required by Perses; there is no `go.mod` or Go SDK.

The Perses CLI (`percli`) is required for the `percli plugin` commands below, but not for the npm checks or build. Install a version matching the Perses dependencies in `package.json` (currently `v0.53.0-beta.3`). With Go installed:

```sh
go install github.com/perses/perses/cmd/percli@v0.53.0-beta.3
export PATH="$(go env GOPATH)/bin:$PATH" # if percli is not already on PATH
percli plugin --help # check the installed CLI's plugin commands
```

If `GOBIN` is set, add that directory to `PATH` instead. Alternatively, download `percli` from a matching [Perses release](https://github.com/perses/perses/releases). These commands install the CLI, not a Perses server; `percli plugin start` also needs a compatible running Perses instance for browser testing.

Run `make all` before committing: it checks the diff, installs dependencies, runs type-checking, lint, unit and local Korrel8r integration tests, and builds and validates the plugin. It requires Go, `curl`, network access, and a compatible `percli`, but not a running Perses server. The equivalent individual commands are:

```sh
npm ci                   # install dependencies from the lockfile
npm run type-check       # check TypeScript types
npm run lint             # run the linter
npm test -- --runInBand  # run unit tests serially
npm run build            # build the plugin module
# With a compatible Perses CLI installed:
percli plugin test-schemas # validate CUE schemas and examples
percli plugin build        # build the Perses plugin package
percli plugin start        # register the dev plugin with a running Perses server
```

### Local datasource integration test (no cluster)

Requires Node.js, Go, `curl`, and network access for `go install github.com/korrel8r/korrel8r/cmd/korrel8r@latest`. No Korrel8r checkout or cluster is needed.

```sh
npm ci                   # install dependencies from the lockfile
npm run test:integration  # test the datasource against a local Korrel8r server
```

The runner installs the upstream Go **tool** into a temporary directory via `go install github.com/korrel8r/korrel8r/cmd/korrel8r@latest` (no Korrel8r checkout needed). It starts the executable bound to `127.0.0.1` with the mock config and store in `testdata/korrel8r/` (adapted from Korrel8r's upstream test fixtures), and calls the *TypeScript datasource client* over real HTTP. It tests neighbor and goal graphs, including the `foobar` edge rule. The runner stops the server and removes its temporary binary on exit. `@latest` is unpinned, so upstream changes may require updating the fixture or client. `--unsafe-shared-session` is for this loopback-only, unauthenticated mock test; do not use it on a shared endpoint. This test bypasses Perses's proxy and browser CORS.

## TODO: complete the prototype

1. Replace the datasource-name text field with Perses's datasource picker in the panel's Settings tab.
2. Integrate the custom Query tab with Perses's native query editor when a graph-specific query type is supported. Until then, query options live in the panel spec and requests are panel-managed; do not misrepresent graph data as `TimeSeriesData`.
3. Interactive rendering to match the troubleshooting panel: icons, context menus, similar layout algorithm, parallel edges, full labels; add zoom/pan, accessible node/edge interaction, query choices and safe navigation links. Keep the full JSON available for troubleshooting.
4. Allow click behavior on graph elements to be supplied externally by the embedding application, rather than hard-coded in the renderer. Use this extension point to reproduce [OpenShift troubleshooting panel](https://github.com/openshift/troubleshooting-panel-console-plugin) behavior in the Perses panel. The current Console implementation is in `troubleshooting-panel-console-plugin/web/src/korrel8r-client.ts` and `web/src/components/topology/Korrel8rTopology.tsx`.
5. Exercise the panel against a real local Perses server with a configured HTTP proxy and a sample dashboard. Verify proxy allowlisting, authentication and CSP/CORS; the current integration test covers direct HTTP only.
6. Revisit bearer-token and TLS management before production: remove the demo's `tlsConfig.insecureSkipVerify: true` and configure the trusted ingress CA (`tlsConfig.ca` or the container trust store); replace the demo's `oc whoami -t` user token and unauthenticated Perses server with an appropriate scoped identity, secure Secret storage, token rotation/refresh and access controls. Determine whether to forward user identity or use a service identity for Korrel8r.
7. Expand API types/validation and add tests for graph variants, failures, time bounds and panel interaction. Tighten the CUE proxy schema against Perses's HTTPProxy schema and prepare the plugin module for upstream contribution.


Perses documentation: [creating plugins](https://github.com/perses/perses/blob/main/docs/plugins/creation.md); [Prometheus datasource and query plugin example](https://github.com/perses/plugins/tree/main/prometheus).
