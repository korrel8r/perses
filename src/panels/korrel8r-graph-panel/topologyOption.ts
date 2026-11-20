import type { Theme } from "@mui/material";
import type { EChartsCoreOption } from "echarts/core";
import type { TopologyGraph, TopologyNode } from "./toTopologyGraph";
import { nodeIcon } from "./nodeIcon";
import {
  displayCount,
  displayName,
  routeSegmentId,
  topologySpan,
} from "./topologyLayout";

export function severity(status: string): "error" | "warning" | "info" {
  if (/error|critical|fatal/i.test(status)) return "error";
  return /warn/i.test(status) ? "warning" : "info";
}

// Material Design error, warning and info glyphs in their standard 24px viewbox.
const statusPaths = {
  error:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
};

/** SVG image symbols keep the icon, status and start markers attached during drag/zoom. */
function symbol(
  icon: string,
  fill: string,
  stroke: string,
  status?: { kind: ReturnType<typeof severity>; color: string },
  start?: boolean,
): string {
  const badge = status
    ? `<circle cx="14" cy="14" r="9" fill="${fill}"/><path d="${statusPaths[status.kind]}" fill="${status.color}" transform="translate(6 6) scale(.67)"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="23" fill="${fill}" stroke="${stroke}" stroke-width="2"/><g transform="translate(19.5 19.5)" color="${stroke}">${icon}</g>${badge}${start ? `<circle cx="50" cy="50" r="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><path d="M50 45v10m-5-5h10" stroke="${stroke}" stroke-width="1.5"/>` : ""}</svg>`;
  return `image://data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function nodeStatuses(
  node: TopologyNode,
): Array<{ status: string; count: number }> {
  const totals = new Map<string, number>();
  node.queries.forEach((query) =>
    query.statuses.forEach(({ status, count }) => {
      if (status) totals.set(status, (totals.get(status) ?? 0) + count);
    }),
  );
  return Array.from(totals, ([status, count]) => ({ status, count }));
}

function tooltip(lines: string[]): HTMLElement {
  const element = document.createElement("div");
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.textContent = line; // Never interpret API-provided names as HTML.
    element.appendChild(row);
  });
  return element;
}

/** ECharts scales graph symbols during zoom, but leaves label pixels unchanged. */
export function topologyLabelMetrics(fitScale: number, zoom: number) {
  const scale = fitScale * zoom;
  return {
    distance: Math.round(scale),
    rich: {
      name: { fontSize: Math.max(1, Math.round(12 * scale)) },
      count: {
        fontSize: Math.max(1, Math.round(11 * scale)),
        padding: [Math.round(2 * scale), Math.round(5 * scale)],
        borderRadius: Math.round(8 * scale),
      },
    },
  };
}

/** Perses supplies the theme and data; only the chart-specific mapping lives here. */
export function topologyOption(
  graph: TopologyGraph,
  positions: ReadonlyMap<string, { x: number; y: number }>,
  fitScale: number,
  zoom: number,
  colors: Theme["palette"],
  routes: ReadonlyMap<
    string,
    ReadonlyArray<{ x: number; y: number }>
  > = new Map(),
): EChartsCoreOption {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const links = graph.edges.filter(
    (edge) => nodes.has(edge.source) && nodes.has(edge.target),
  );
  // Graph links cannot take waypoints directly. Invisible, non-draggable graph
  // nodes at Dagre's bends share the graph's zoom/pan and node drag transforms.
  const usedIds = new Set(graph.nodes.map((node) => node.id));
  const waypoints: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    symbolSize: number;
    draggable: boolean;
    label: { show: boolean };
    tooltip: { show: boolean };
  }> = [];
  const routedLinks = links.flatMap((edge) => {
    const points = routes.get(edge.id)?.slice(1, -1) ?? [];
    const path = [edge.source];
    points.forEach(({ x, y }, index) => {
      let id = `__korrel8r_waypoint__:${edge.id}:${index}`;
      while (usedIds.has(id)) id += ":";
      usedIds.add(id);
      waypoints.push({
        id,
        name: id,
        x,
        y,
        symbolSize: 0,
        draggable: false,
        label: { show: false },
        tooltip: { show: false },
      });
      path.push(id);
    });
    path.push(edge.target);
    return path.slice(1).map((target, index) => ({
      id: routeSegmentId(edge.id, index),
      name: edge.id,
      source: path[index]!,
      target,
      // ECharts reads per-edge `symbol`, not per-edge `edgeSymbol`.
      symbol: ["none", index === path.length - 2 ? "arrow" : "none"],
      lineStyle: { curveness: 0 },
    }));
  });
  const segmentEdges = new Map(
    routedLinks.map((link) => [link.id, edges.get(link.name)]),
  );
  const span = topologySpan(
    new Map([
      ...positions,
      ...waypoints.map(({ id, x, y }) => [id, { x, y }] as const),
    ]),
  );
  // ECharts' SVG text renderer requires integral font metrics at small sizes.
  const labelMetrics = topologyLabelMetrics(fitScale, zoom);
  return {
    animation: false,
    tooltip: {
      trigger: "item",
      formatter: (params: { dataType?: string; name?: string }) => {
        if (params.dataType === "edge") {
          const edge =
            segmentEdges.get(params.name ?? "") ?? edges.get(params.name ?? "");
          return tooltip(
            edge?.ruleNames.length ? edge.ruleNames : ["Correlation"],
          );
        }
        const node = nodes.get(params.name ?? "");
        if (!node) return "";
        return tooltip([
          node.id,
          `${node.count} results`,
          ...(node.isStart ? ["Search started here"] : []),
          ...(node.unavailableReason ? [node.unavailableReason] : []),
          ...nodeStatuses(node).map(
            ({ status, count }) => `${status}: ${count}`,
          ),
        ]);
      },
    },
    series: [
      {
        type: "graph",
        layout: "none",
        // Replacing the data after a drag must retain the current wheel zoom.
        zoom,
        // Equal data/pixel spans on both axes prevent stretched symbols on flat graphs.
        left: "center",
        top: "center",
        width: Math.max(2, span.width) * fitScale,
        height: Math.max(2, span.height) * fitScale,
        roam: true,
        draggable: true,
        nodeScaleRatio: 1,
        scaleLimit: { min: 0.2, max: 5 },
        // Only the last segment of each routed edge gets an arrow.
        edgeSymbol: ["none", "none"],
        edgeSymbolSize: 9 * fitScale,
        lineStyle: {
          color: colors.text.secondary,
          width: 1.5 * fitScale,
          curveness: 0.12,
        },
        label: {
          show: true,
          position: "bottom",
          distance: labelMetrics.distance,
          color: colors.text.primary,
          formatter: (params: { name: string }) => {
            const node = nodes.get(params.name);
            return node
              ? `{name|${displayName(node)}} {count|${displayCount(node)}}${node.queries.length > 1 && !node.unavailableReason ? " {name|⋮}" : ""}`
              : "";
          },
          rich: {
            name: {
              color: colors.text.primary,
              ...labelMetrics.rich.name,
            },
            count: {
              color: colors.primary.contrastText,
              backgroundColor: colors.primary.main,
              ...labelMetrics.rich.count,
            },
          },
        },
        data: [
          ...graph.nodes.map((node) => {
            const statuses = nodeStatuses(node);
            const worst = statuses.some(
              ({ status }) => severity(status) === "error",
            )
              ? "error"
              : statuses.some(({ status }) => severity(status) === "warning")
                ? "warning"
                : statuses.length
                  ? "info"
                  : undefined;
            return {
              id: node.id,
              name: node.id,
              ...positions.get(node.id),
              symbol: symbol(
                nodeIcon(node.id),
                colors.background.paper,
                node.unavailableReason
                  ? colors.text.disabled
                  : colors.text.primary,
                !node.unavailableReason && worst
                  ? { kind: worst, color: colors[worst].main }
                  : undefined,
                node.isStart,
              ),
              symbolSize: 64 * fitScale,
              itemStyle: { opacity: node.unavailableReason ? 0.35 : 1 },
            };
          }),
          ...waypoints,
        ],
        links: routedLinks,
      },
    ],
  };
}
