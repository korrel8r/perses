# Korrel8r Perses plugins

Perses plugin module for a **Korrel8rDatasource** and a **Korrel8rGraphPanel** .

This repository is intended to resolve implementation questions before contributing the code to https://github.com/perses/plugins

Repository layout generated with `percli plugin generate` from https://github.com/perses/perses

## Status

**Datasource — prototype with security issues:** Supports direct or Perses-proxied requests to Korrel8r `POST /graphs/neighbors` and `POST /graphs/goals` at the `/api/v1alpha1` API root.

The local demo uses an `oc whoami -t` user token in a Perses Secret, an unauthenticated Perses server with its default encryption key, and `tlsConfig.insecureSkipVerify: true`. **Do not use the demo authentication or TLS configuration in production.** The client has direct-HTTP integration tests, but proxy authentication, token lifecycle, CORS and the full API response types still need verification.

**Panel — interactive graph prototype:** Custom Query tab configures neighbor or goal requests, using Perses dashboard time range. `toTopologyGraph` maps the response to an ECharts graph with Dagre-positioned nodes and routed edges; class/domain icons, count badges, status markers, rule tooltips, query menu, node dragging, zoom/pan and direction controls. Accepts optional node, edge, and query callbacks via props or an application-provided React Context; it does not navigate on its own. The full response and errors are available as JSON. Class icons, layout and theme still need work.

**Next steps:** See the TODO below.

## Demo

On Linux, install Node.js, `percli`, `oc`, `curl`, and Podman or Docker. Log in with `oc login` and start Korrel8r separately. Set its **base URL** (without `/api/v1alpha1`), then run:

```sh
export KORREL8R_URL=http://127.0.0.1:8081 # replace with your Korrel8r URL
./scripts/run-demo.sh
```

The script checks an authenticated graph request, starts local Perses and the demo plugin, provisions the **Dummy** project, datasource and dashboard, then opens <http://localhost:8080/projects/Dummy/dashboards/Dummy>. Set `OPEN_BROWSER=0` to skip the browser; press Ctrl-C to stop the servers. Data is ephemeral. Perses shares the host network and must be able to reach `KORREL8R_URL`. If preflight returns **HTTP 503**, check the URL and the Korrel8r route, endpoints and pods (`oc get routes,services,endpoints,pods -n <namespace>`).

The panel starts with neighbor query `k8s:ConfigMap:{}` at depth 1 - a quick non-empty query on most clusters. To change it, select dashboard **Edit**, the panel **pencil**, and the **Query** tab. Choose **Neighbors** (depth) or **Goals** (class names), then **Apply** and **Save**. The graph follows the dashboard time range. Expand **Full Korrel8r JSON response** to inspect the result; use **Settings** for a nondefault datasource.

The demo uses `demo/rsbuild.config.ts`: node/edge clicks and query selections show the callback data in a dismissible JSON dialog. That data may be sensitive. Normal builds use `rsbuild.config.ts` and do not include the dialog; dashboard specs contain no demo callbacks.

**Local demo only:** the script stores your `oc whoami -t` token in a Perses Secret, disables upstream TLS verification, and runs unauthenticated Perses with its default encryption key on `127.0.0.1:8080`. Do not expose or reuse this setup in production. See the TODO for authentication and CA trust.

Podman is preferred; set `CONTAINER_ENGINE=docker` to use Docker or `PERSES_IMAGE` to choose an image. TypeScript hot-reloads; restart the demo after schema changes. For other dashboards, use a **Korrel8r Datasource** at the `/api/v1alpha1` API root and add a **Korrel8r Graph Panel**. Direct browser access requires CORS; the HTTP proxy does not. Saved kinds are `Korrel8rDatasource` and `Korrel8rGraphPanel`.

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
3. Refine the graph to match the troubleshooting display: accessible keyboard node/edge interaction, unavailable destinations, and better layout of large, cyclic or highly connected graphs. Keep the full JSON available for troubleshooting.
4. Supply navigation and clipboard behavior from the embedding application through the renderer's optional callbacks, rather than hard-coding console-specific URLs in the Perses panel. The panel intentionally leaves these unset.
5. Exercise the panel against a real local Perses server with a configured HTTP proxy and a sample dashboard. Verify proxy allowlisting, authentication and CSP/CORS; the current integration test covers direct HTTP only.
6. Revisit bearer-token and TLS management before production: remove the demo's `tlsConfig.insecureSkipVerify: true` and configure the trusted ingress CA (`tlsConfig.ca` or the container trust store); replace the demo's `oc whoami -t` user token and unauthenticated Perses server with an appropriate scoped identity, secure Secret storage, token rotation/refresh and access controls. Determine whether to forward user identity or use a service identity for Korrel8r.
7. Expand API types/validation and add tests for graph variants, failures, time bounds and panel interaction. Tighten the CUE proxy schema against Perses's HTTPProxy schema and prepare the plugin module for upstream contribution.
8. Improve error handling: distinguish Korrel8r API errors from Perses proxy, authentication, network and OpenShift route failures; provide actionable messages and appropriate retry/cancellation states while retaining the full response for troubleshooting.
9. Refine the graph theme styling (colors, typography, badges and contrast) 
10. Review icon management and consistency with the rest of the OpenShift console: align class/domain mappings, SVG sources, sizing, theme colors, and attribution; avoid duplicating icon definitions where practical.


Perses documentation: [creating plugins](https://github.com/perses/perses/blob/main/docs/plugins/creation.md); [Prometheus datasource and query plugin example](https://github.com/perses/plugins/tree/main/prometheus).
