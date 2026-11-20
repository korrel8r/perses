import { Alert, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useDatasourceStore, useTimeRange } from "@perses-dev/plugin-system";
import { useMemo } from "react";
import type { ReactElement } from "react";
import {
  Korrel8rHTTPError,
  Korrel8rResponseError,
} from "../../datasources/korrel8r-datasource/korrel8r-datasource-types";
import type {
  Korrel8rDatasourceClient,
  Korrel8rGraph,
} from "../../datasources/korrel8r-datasource/korrel8r-datasource-types";
import {
  DEFAULT_NEIGHBOR_DEPTH,
  type Korrel8rGraphPanelProps,
} from "./korrel8r-graph-panel-types";
import { Korrel8rTopology } from "./Korrel8rTopology";
import { toTopologyGraph } from "./toTopologyGraph";
import { parseGoals } from "./parseGoals";

function LoadingIndicator(): ReactElement {
  return (
    <div
      role="status"
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <CircularProgress size={18} aria-label="Loading Korrel8r graph" />
      <span>Loading Korrel8r graph…</span>
    </div>
  );
}

function JsonText({ value }: { value: unknown }): ReactElement {
  return (
    <pre
      style={{
        overflow: "auto",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function Korrel8rGraphPanelComponent({
  spec,
  contentDimensions,
}: Korrel8rGraphPanelProps): ReactElement {
  const datasourceStore = useDatasourceStore();
  const { absoluteTimeRange } = useTimeRange();
  const startQuery = spec.startQuery?.trim() ?? "";
  const mode = spec.mode ?? "neighbors";
  const goals = parseGoals(spec.goals ?? "");
  const datasource = {
    kind: "Korrel8rDatasource",
    ...(spec.datasourceName ? { name: spec.datasourceName } : {}),
  };
  const graphStart = {
    queries: [startQuery],
    constraint: {
      start: absoluteTimeRange.start.toISOString(),
      end: absoluteTimeRange.end.toISOString(),
      ...(spec.limit === undefined ? {} : { limit: spec.limit }),
    },
  };
  // Include only the options used by this mode in both the request and its key.
  const graphRequest =
    mode === "goals"
      ? { mode, goals }
      : { mode, depth: spec.depth ?? DEFAULT_NEIGHBOR_DEPTH };
  const { data, error, isLoading, isFetching } = useQuery<Korrel8rGraph, Error>(
    {
      queryKey: [
        "query",
        "Korrel8rGraphPanel",
        datasource,
        graphStart,
        graphRequest,
      ],
      enabled: startQuery.length > 0 && (mode !== "goals" || goals.length > 0),
      queryFn: async ({ signal }) => {
        const client =
          await datasourceStore.getDatasourceClient<Korrel8rDatasourceClient>(
            datasource,
          );
        return graphRequest.mode === "goals"
          ? client.graphGoals(graphStart, graphRequest.goals, signal)
          : client.graphNeighbors(graphStart, graphRequest.depth, signal);
      },
    },
  );
  // A stable graph identity preserves the user's drag, fit and zoom state on
  // unrelated panel renders (including fetch-progress and size updates).
  const goalClasses = mode === "goals" ? (spec.goals ?? "") : "";
  const topology = useMemo(
    () =>
      data && Array.isArray(data.nodes)
        ? toTopologyGraph(data, {
            startQueries: [startQuery],
            goalClasses: parseGoals(goalClasses),
          })
        : undefined,
    [data, startQuery, goalClasses],
  );

  if (!startQuery)
    return <div role="status">Set a Korrel8r query in Query.</div>;
  if (mode === "goals" && goals.length === 0)
    return <div role="status">Set at least one goal class in Query.</div>;
  if (isLoading) return <LoadingIndicator />;
  if (error) {
    const isHttpError = error instanceof Korrel8rHTTPError;
    const body =
      (isHttpError || error instanceof Korrel8rResponseError) &&
      error.body !== "" &&
      error.body != null
        ? error.body
        : { error: error.message };
    // OpenShift's router returns an HTML 503 page when a route has no working
    // backend. Avoid dumping that entire page as the primary error message.
    if (
      isHttpError &&
      error.status === 503 &&
      typeof body === "string" &&
      body.includes("Application is not available")
    ) {
      return (
        <div role="alert">
          <strong>Korrel8r is unavailable (HTTP 503)</strong>
          <p>
            The configured Korrel8r route has no available backend. Check the
            datasource URL and the OpenShift route, service endpoints and pods.
          </p>
          <details>
            <summary>Full server response</summary>
            <JsonText value={body} />
          </details>
        </div>
      );
    }
    return (
      <div role="alert">
        {isHttpError
          ? `HTTP ${error.status} ${error.statusText}`
          : "Korrel8r graph request failed"}
        <JsonText value={body} />
      </div>
    );
  }
  if (!data) return <div role="status">No Korrel8r graph response.</div>;
  if (!topology)
    return (
      <Alert severity="info" role="status">
        Empty graph
      </Alert>
    );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        width: "100%",
        height: contentDimensions?.height || 340,
        minHeight: 0,
      }}
    >
      {isFetching && (
        <div
          style={{
            position: "absolute",
            zIndex: 1,
            right: 8,
            bottom: 8,
            background: "inherit",
          }}
        >
          <LoadingIndicator />
        </div>
      )}
      {topology.nodes.length > 0 ? (
        <div style={{ flex: "1 1 0", minHeight: 0 }}>
          <Korrel8rTopology graph={topology} />
        </div>
      ) : (
        <div role="status">No nodes found in the Korrel8r graph.</div>
      )}
      <details style={{ flex: "0 0 auto", maxHeight: "50%", overflow: "auto" }}>
        <summary>Full Korrel8r JSON response</summary>
        <JsonText value={data} />
      </details>
    </div>
  );
}
