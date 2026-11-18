import { useId } from "react";
import type { ReactElement } from "react";
import type { TopologyGraph } from "./toTopologyGraph";

const NODE_RADIUS = 28;
const LABEL_SPACE = 72; // Room under each node for its label and statuses.
const NODE_SPACING = 120; // Ring circumference reserved per node.
const MIN_RADIUS = 120;
const MIN_SIZE = 320;
const MAX_LABEL = 24;

/** Shorten long class names; the node title still shows the full label. */
function shortLabel(label: string): string {
  return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
}

/**
 * Static SVG whose square viewBox scales uniformly to fit the panel. Nodes sit
 * on a ring that grows only as far as the node count requires, so labels keep
 * a predictable size instead of shrinking with the panel's aspect ratio.
 */
export function Korrel8rTopology({
  graph,
}: {
  graph: TopologyGraph;
}): ReactElement {
  const arrowId = useId();
  const count = graph.nodes.length;
  const radius =
    count > 1
      ? Math.max(MIN_RADIUS, (NODE_SPACING * count) / (2 * Math.PI))
      : 0;
  const size = Math.max(
    MIN_SIZE,
    Math.round(2 * (radius + NODE_RADIUS + LABEL_SPACE)),
  );
  const center = size / 2;
  const positions = new Map(
    graph.nodes.map((node, index) => {
      // Start at the top and go clockwise so the layout is stable and readable.
      const angle = (2 * Math.PI * index) / count - Math.PI / 2;
      return [
        node.id,
        {
          x: center + Math.cos(angle) * radius,
          y: center + Math.sin(angle) * radius,
        },
      ] as const;
    }),
  );

  return (
    <div style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}>
      <svg
        role="img"
        aria-label={`Korrel8r graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges`}
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id={arrowId}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {graph.edges.map((edge) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          // Keep the raw response available below if an endpoint is absent.
          if (!source || !target) return null;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.hypot(dx, dy);
          const selfLoop = distance === 0;
          const path = selfLoop
            ? `M ${source.x + NODE_RADIUS} ${source.y} C ${source.x + 75} ${source.y - 110}, ${source.x - 75} ${source.y - 110}, ${source.x - NODE_RADIUS} ${source.y}`
            : `M ${source.x + (dx / distance) * NODE_RADIUS} ${source.y + (dy / distance) * NODE_RADIUS} L ${target.x - (dx / distance) * (NODE_RADIUS + 10)} ${target.y - (dy / distance) * (NODE_RADIUS + 10)}`;
          return (
            <g key={edge.id}>
              <title>{`${edge.source} → ${edge.target}${edge.ruleNames.length ? ` (rules: ${edge.ruleNames.join(", ")})` : ""}`}</title>
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                markerEnd={`url(#${arrowId})`}
              />
              {edge.ruleNames.length > 0 && (
                <text
                  x={selfLoop ? source.x : (source.x + target.x) / 2}
                  y={selfLoop ? source.y - 90 : (source.y + target.y) / 2 - 8}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="11"
                >
                  {shortLabel(edge.ruleNames.join(", "))}
                </text>
              )}
            </g>
          );
        })}
        {graph.nodes.map((node) => {
          const position = positions.get(node.id)!;
          const statuses = node.queries.flatMap((query) => query.statuses);
          return (
            <g key={node.id}>
              <title>{`${node.label}: ${node.count} results${node.isStart ? ", start" : ""}${node.isGoal ? ", goal" : ""}`}</title>
              <circle
                cx={position.x}
                cy={position.y}
                r={NODE_RADIUS}
                fill="Canvas"
                stroke="currentColor"
                strokeWidth={node.isStart || node.isGoal ? 3 : 1.5}
              />
              <text
                x={position.x}
                y={position.y + 5}
                textAnchor="middle"
                fill="currentColor"
                fontSize="14"
              >
                {node.count}
              </text>
              <text
                x={position.x}
                y={position.y + NODE_RADIUS + 17}
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
              >
                {shortLabel(node.label)}
                {node.isStart && " (start)"}
                {node.isGoal && " (goal)"}
              </text>
              {statuses.length > 0 && (
                <text
                  x={position.x}
                  y={position.y + NODE_RADIUS + 33}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="10"
                >
                  {statuses
                    .map(({ status, count }) => `${status}: ${count}`)
                    .join(", ")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
