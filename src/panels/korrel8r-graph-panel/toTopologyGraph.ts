import type { Korrel8rGraph } from "../../datasources/korrel8r-datasource/korrel8r-datasource-types";

// Renderer-neutral model: no Perses, ECharts, or PatternFly dependencies.
export interface TopologyNode {
  id: string; // Korrel8r class; also used as the endpoint of directed edges.
  label: string;
  count: number;
  queries: Array<{
    query: string;
    count: number;
    statuses: Array<{ status: string; count: number }>;
  }>;
  isStart: boolean;
  isGoal: boolean;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  ruleNames: string[];
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface TopologyContext {
  startQueries?: readonly string[];
  goalClasses?: readonly string[];
}

/** Convert Korrel8r's class graph without modifying the response or its ordering. */
export function toTopologyGraph(
  graph: Korrel8rGraph,
  { startQueries = [], goalClasses = [] }: TopologyContext = {},
): TopologyGraph {
  const goals = new Set(goalClasses);
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.class,
      label: node.class,
      count: node.count,
      queries: (node.queries ?? []).map((query) => ({
        query: query.query,
        count: query.count,
        statuses: (query.statuses ?? []).map(({ status, count }) => ({
          status,
          count,
        })),
      })),
      // Korrel8r queries begin with '<class>:'; don't split at the first
      // colon because class names such as 'k8s:Pod' contain colons.
      isStart: startQueries.some(
        (query) => query === node.class || query.startsWith(`${node.class}:`),
      ),
      isGoal: goals.has(node.class),
    })),
    edges: (graph.edges ?? []).map((edge, index) => ({
      id: `${edge.start}->${edge.goal}#${index}`,
      source: edge.start,
      target: edge.goal,
      ruleNames: (edge.rules ?? []).map((rule) => rule.name),
    })),
  };
}
