import * as dagre from "@dagrejs/dagre";
import type { TopologyGraph, TopologyNode } from "./toTopologyGraph";

export type LayoutDirection = "LR" | "TB";

const NODE_DIAMETER = 64;
const LABEL_GAP = 8;
const NODE_HEIGHT = 100; // 64px icon, 8px label gap, ~16px label and clearance.
const SIDE_PADDING = 12;
const TOP_PADDING = 40;
const BOTTOM_PADDING = 72; // Allow for ECharts' label baseline and rounded font metrics.

export function displayName(node: TopologyNode): string {
  const name = node.label
    .replace(/^[^:]*:/, "")
    .replace(/\.v\d+.*$/, "")
    .replace(/[{}]/g, "")
    .slice(0, 28)
    .replace(/^./, (character) => character.toUpperCase());
  return node.id.startsWith("log:") && !/\s+Log$/i.test(name)
    ? `${name} Log`
    : name;
}

export function displayCount(node: TopologyNode): string {
  const highest = Math.max(0, ...node.queries.map((query) => query.count));
  return node.queries.length > 1
    ? `${highest}/${node.count}`
    : String(node.count);
}

// ECharts draws labels in fixed screen pixels. Approximate the 12px font width
// so short labels take little space while long class names get enough room.
function textWidth(text: string): number {
  return Array.from(text).reduce(
    (width, character) =>
      width +
      (/[WM@#%]/.test(character) ? 11 : /[il.,:;|!]/.test(character) ? 4 : 7.5),
    0,
  );
}

export function nodeLabelWidth(node: TopologyNode): number {
  return Math.max(
    NODE_DIAMETER,
    textWidth(displayName(node)) +
      textWidth(displayCount(node)) +
      16 +
      (node.queries.length > 1 && !node.unavailableReason ? 12 : 0),
  );
}

export function routeSegmentId(edgeId: string, index: number): string {
  return `${edgeId}:segment:${index}`;
}

export interface RoutedLayout {
  positions: Map<string, { x: number; y: number }>;
  /** Dagre's edge boundary points and bends, in source-to-target order. */
  routes: Map<string, Array<{ x: number; y: number }>>;
}

/** Dagre ranks directed nodes and routes links around their labels. */
export function layoutTopologyWithRoutes(
  graph: TopologyGraph,
  direction: LayoutDirection,
): RoutedLayout {
  const layout = new dagre.graphlib.Graph({ multigraph: true });
  layout.setGraph({ rankdir: direction, nodesep: LABEL_GAP + 16, ranksep: 36 });
  layout.setDefaultEdgeLabel(() => ({}));
  // Sorting prevents unrelated server ordering changes from reshuffling the layout.
  for (const node of [...graph.nodes].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    layout.setNode(node.id, {
      width: nodeLabelWidth(node),
      height: NODE_HEIGHT,
    });
  }
  for (const edge of [...graph.edges].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (layout.hasNode(edge.source) && layout.hasNode(edge.target)) {
      layout.setEdge(edge.source, edge.target, {}, edge.id);
    }
  }
  if (!graph.nodes.length) return { positions: new Map(), routes: new Map() };
  dagre.layout(layout);
  // Dagre returns node centres in positive coordinates. Shift their minimum
  // to zero; the existing renderer centres the resulting span in the viewport.
  const nodes = graph.nodes.map((node) => ({
    id: node.id,
    ...layout.node(node.id),
  }));
  const minX = Math.min(...nodes.map(({ x }) => x));
  const minY = Math.min(...nodes.map(({ y }) => y));
  const positions = new Map(
    nodes.map(({ id, x, y }) => [id, { x: x - minX, y: y - minY }]),
  );
  const routes = new Map<string, Array<{ x: number; y: number }>>();
  for (const edge of graph.edges) {
    if (layout.hasEdge(edge.source, edge.target, edge.id)) {
      routes.set(
        edge.id,
        layout
          .edge(edge.source, edge.target, edge.id)
          .points.map(({ x, y }) => ({ x: x - minX, y: y - minY })),
      );
    }
  }
  return { positions, routes };
}

/** Node-only convenience API for layout consumers that do not render links. */
export function layoutTopology(
  graph: TopologyGraph,
  direction: LayoutDirection,
) {
  return layoutTopologyWithRoutes(graph, direction).positions;
}

type Position = { x: number; y: number };

function bounds(points: Iterable<Position>) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return minX === Infinity
    ? { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    : { minX, maxX, minY, maxY };
}

/** Span of node centers (symbols and labels have their own pixel dimensions). */
export function topologySpan(positions: ReadonlyMap<string, Position>): {
  width: number;
  height: number;
} {
  const { minX, maxX, minY, maxY } = bounds(positions.values());
  return { width: maxX - minX, height: maxY - minY };
}

/** Minimum chart size to keep ECharts' fixed-pixel symbols and labels apart. */
export function topologyCanvasSize(
  graph: TopologyGraph,
  positions: ReadonlyMap<string, { x: number; y: number }>,
  currentPositions: ReadonlyMap<string, { x: number; y: number }> = positions,
  zoom = 1,
  routes: Iterable<readonly Position[]> = [],
): { width: number; height: number } {
  const routePoints = Array.from(routes).flat();
  const initial = bounds([...positions.values(), ...routePoints]);
  const centerX = (initial.minX + initial.maxX) / 2;
  const centerY = (initial.minY + initial.maxY) / 2;
  const current = bounds([
    ...Array.from(
      positions,
      ([id, position]) => currentPositions.get(id) ?? position,
    ),
    ...routePoints,
  ]);
  const extentX = Math.max(centerX - current.minX, current.maxX - centerX);
  const extentY = Math.max(centerY - current.minY, current.maxY - centerY);
  const nodeScale = zoom; // Match topologyOption's nodeScaleRatio: 1.
  const largestLabel = Math.max(
    NODE_DIAMETER,
    ...graph.nodes.map(nodeLabelWidth),
  );
  return {
    width: Math.ceil(
      Math.max(
        120,
        2 * extentX * zoom + (largestLabel + 2 * SIDE_PADDING) * nodeScale,
      ),
    ),
    height: Math.ceil(
      Math.max(
        120,
        2 * extentY * zoom + (TOP_PADDING + BOTTOM_PADDING) * nodeScale,
      ),
    ),
  };
}
