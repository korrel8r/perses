# Korrel8r graph panel demo

This directory contains a **demo-only** Perses plugin entry point. It wraps the graph panel with a dialog that displays node, edge, and query-selection callback data as JSON. Normal builds use `src/` instead and do not include the dialog.

To run the demo on Linux, install Node.js, `percli`, `oc`, `curl`, and Podman or Docker. Log in with `oc login`, start Korrel8r separately, then from the repository root run:

```sh
export KORREL8R_URL=http://127.0.0.1:8081 # Korrel8r base URL, without /api/v1alpha1
./scripts/run-demo.sh
```

The script provisions a local Perses **Dummy** dashboard and opens <http://localhost:8080/projects/Dummy/dashboards/Dummy>. Set `OPEN_BROWSER=0` to skip opening the browser; press Ctrl-C to stop the demo. Edit the panel's **Query** tab to try other graph queries. The demo files are:

- `Korrel8rGraphPanelDemo.tsx` — callback dialog and demo plugin entry point.
- `rsbuild.config.ts` — selects that entry point for the demo build.
- `Korrel8rGraphPanelDemo.test.tsx` — callback dialog tests.

**Local demo only:** the script uses your `oc whoami -t` token in a Perses Secret, disables upstream TLS verification, and starts unauthenticated Perses with its default encryption key. The dialog and graph responses may contain sensitive data. Do not expose or reuse this setup in production. See the [repository README](../README.md#demo) for troubleshooting and more details.
