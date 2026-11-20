import type { Korrel8rGraph } from "../../datasources/korrel8r-datasource/korrel8r-datasource-types";
import { toTopologyGraph } from "./toTopologyGraph";

function deepFreeze(value: unknown): void {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
}

test("maps classes, queries, statuses and directed rule-bearing edges", () => {
  const graph: Korrel8rGraph = {
    nodes: [
      {
        class: "k8s:Pod",
        count: 4,
        queries: [
          {
            query: 'k8s:Pod:{namespace="default"}',
            count: 2,
            statuses: [
              { status: "ok", count: 1 },
              { status: "warning", count: 1 },
            ],
          },
        ],
      },
      { class: "log:record", count: 7 },
    ],
    edges: [
      {
        start: "k8s:Pod",
        goal: "log:record",
        rules: [{ name: "pod-logs" }, { name: "pod-events" }],
      },
      { start: "log:record", goal: "k8s:Pod" },
    ],
  };
  deepFreeze(graph);

  const topology = toTopologyGraph(graph, {
    startQueries: ['k8s:Pod:{namespace="default"}'],
    goalClasses: ["log:record"],
  });
  expect(topology).toEqual({
    nodes: [
      {
        id: "k8s:Pod",
        label: "k8s:Pod",
        count: 4,
        queries: [
          {
            query: 'k8s:Pod:{namespace="default"}',
            count: 2,
            statuses: [
              { status: "ok", count: 1 },
              { status: "warning", count: 1 },
            ],
          },
        ],
        isStart: true,
        isGoal: false,
      },
      {
        id: "log:record",
        label: "log:record",
        count: 7,
        queries: [],
        isStart: false,
        isGoal: true,
      },
    ],
    edges: [
      {
        id: "k8s:Pod->log:record#0",
        source: "k8s:Pod",
        target: "log:record",
        ruleNames: ["pod-logs", "pod-events"],
      },
      {
        id: "log:record->k8s:Pod#1",
        source: "log:record",
        target: "k8s:Pod",
        ruleNames: [],
      },
    ],
  });
  // Modifying the renderer model must not modify cached API results.
  topology.nodes[0]!.queries[0]!.statuses[0]!.status = "changed";
  topology.edges[0]!.ruleNames.push("new-rule");
  expect(graph.nodes[0]!.queries![0]!.statuses![0]!.status).toBe("ok");
  expect(graph.edges![0]!.rules).toHaveLength(2);
});

test("handles missing, empty and parallel edges without inventing nodes", () => {
  expect(toTopologyGraph({ nodes: [], edges: [] })).toEqual({
    nodes: [],
    edges: [],
  });
  // Korrel8r omits empty lists: a single-node graph has no "edges" field.
  expect(toTopologyGraph({ nodes: [{ class: "mock:foo", count: 1 }] })).toEqual(
    {
      nodes: [
        {
          id: "mock:foo",
          label: "mock:foo",
          count: 1,
          queries: [],
          isStart: false,
          isGoal: false,
        },
      ],
      edges: [],
    },
  );
  expect(toTopologyGraph({ nodes: [] })).toEqual({ nodes: [], edges: [] });
  const topology = toTopologyGraph({
    nodes: [{ class: "mock:foo", count: 0 }],
    edges: [
      { start: "mock:foo", goal: "mock:bar" },
      { start: "mock:foo", goal: "mock:bar" },
    ],
  });
  expect(topology.nodes).toHaveLength(1);
  expect(topology.edges.map((edge) => edge.id)).toEqual([
    "mock:foo->mock:bar#0",
    "mock:foo->mock:bar#1",
  ]);
});

test("only marks complete class prefixes as starting nodes", () => {
  const topology = toTopologyGraph(
    {
      nodes: [
        { class: "k8s:Pod", count: 1 },
        { class: "k8s:PodExtra", count: 1 },
      ],
      edges: [],
    },
    { startQueries: ["k8s:PodExtra:{}"] },
  );
  expect(topology.nodes.map((node) => node.isStart)).toEqual([false, true]);
});
