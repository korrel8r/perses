import {
  displayName,
  layoutTopology,
  nodeLabelWidth,
  topologyCanvasSize,
} from "./topologyLayout";
import type { TopologyGraph } from "./toTopologyGraph";

const node = (id: string, isStart = false) => ({
  id,
  label: id,
  count: 0,
  queries: [],
  isStart,
  isGoal: false,
});

test("capitalizes display labels and appends Log only for the log domain", () => {
  expect(displayName(node("log:application"))).toBe("Application Log");
  expect(displayName(node("log:Application Log"))).toBe("Application Log");
  expect(displayName(node("k8s:pod.v1"))).toBe("Pod");
  expect(displayName(node("metric:cpu"))).toBe("Cpu");
  expect(displayName(node("other:thing"))).toBe("Thing");
  expect(nodeLabelWidth(node("log:application"))).toBeGreaterThan(
    nodeLabelWidth(node("k8s:application")),
  );
});

test("lays out directed chains by layer in both directions", () => {
  const graph: TopologyGraph = {
    nodes: [node("a", true), node("b"), node("c")],
    edges: [
      { id: "ab", source: "a", target: "b", ruleNames: [] },
      { id: "bc", source: "b", target: "c", ruleNames: [] },
    ],
  };
  const horizontal = layoutTopology(graph, "LR");
  const vertical = layoutTopology(graph, "TB");
  expect(horizontal.get("a")!.x).toBeLessThan(horizontal.get("b")!.x);
  expect(horizontal.get("b")!.x).toBeLessThan(horizontal.get("c")!.x);
  expect(vertical.get("a")!.y).toBeLessThan(vertical.get("b")!.y);
  expect(vertical.get("b")!.y).toBeLessThan(vertical.get("c")!.y);
  expect(horizontal.get("b")!.x - horizontal.get("a")!.x).toBe(80); // 64px symbol/label plus 16px between ranks.
  expect(vertical.get("b")!.y - vertical.get("a")!.y).toBe(116);
  expect(topologyCanvasSize(graph, horizontal).width).toBeGreaterThan(232);
  expect(topologyCanvasSize(graph, vertical).height).toBeGreaterThan(272);
  const shuffled = layoutTopology(
    { ...graph, nodes: graph.nodes.slice().reverse() },
    "LR",
  );
  expect(shuffled.get("a")!.x).toBeLessThan(shuffled.get("b")!.x);
  expect(shuffled.get("b")!.x).toBeLessThan(shuffled.get("c")!.x);
});

test("siblings in a top-to-bottom row have room for labels and badges", () => {
  const graph: TopologyGraph = {
    nodes: [node("a", true), node("b"), node("c")],
    edges: [
      { id: "ab", source: "a", target: "b", ruleNames: [] },
      { id: "ac", source: "a", target: "c", ruleNames: [] },
    ],
  };
  const positions = layoutTopology(graph, "TB");
  expect(positions.get("c")!.x - positions.get("b")!.x).toBe(76); // 64px labels plus 12px between siblings.
  expect(positions.get("b")!.y).toBe(positions.get("c")!.y);
  expect(topologyCanvasSize(graph, positions).width).toBeGreaterThan(160);
});

test("reserves more horizontal space only for long adjacent labels", () => {
  const short: TopologyGraph = {
    nodes: [node("a"), node("b")],
    edges: [{ id: "ab", source: "a", target: "b", ruleNames: [] }],
  };
  const long: TopologyGraph = {
    ...short,
    nodes: [
      node("a"),
      { ...node("b"), label: "k8s:VeryWideDeploymentClass.v1" },
    ],
  };
  const shortPositions = layoutTopology(short, "LR");
  const longPositions = layoutTopology(long, "LR");
  const shortGap = shortPositions.get("b")!.x - shortPositions.get("a")!.x;
  const longGap = longPositions.get("b")!.x - longPositions.get("a")!.x;
  expect(shortGap).toBeGreaterThanOrEqual(64);
  expect(longGap).toBeGreaterThan(shortGap);
  expect(longGap).toBeLessThan(250);
  const longTB = layoutTopology(long, "TB");
  expect(topologyCanvasSize(long, longTB).height).toBeGreaterThanOrEqual(186);
});

test("Dagre keeps crossing-prone branches and parallel edges stable regardless of input order", () => {
  const graph: TopologyGraph = {
    nodes: [node("start"), node("left"), node("right"), node("end")],
    edges: [
      { id: "s-l", source: "start", target: "left", ruleNames: [] },
      { id: "s-r", source: "start", target: "right", ruleNames: [] },
      { id: "l-e", source: "left", target: "end", ruleNames: [] },
      { id: "r-e", source: "right", target: "end", ruleNames: [] },
      { id: "r-e-2", source: "right", target: "end", ruleNames: [] },
    ],
  };
  for (const direction of ["TB", "LR"] as const) {
    const positions = layoutTopology(graph, direction);
    const reversed = layoutTopology(
      {
        nodes: [...graph.nodes].reverse(),
        edges: [...graph.edges].reverse(),
      },
      direction,
    );
    for (const { id } of graph.nodes)
      expect(reversed.get(id)).toEqual(positions.get(id));
    const rank = direction === "TB" ? "y" : "x";
    expect(positions.get("start")![rank]).toBeLessThan(
      positions.get("left")![rank],
    );
    expect(positions.get("start")![rank]).toBeLessThan(
      positions.get("right")![rank],
    );
    expect(positions.get("end")![rank]).toBeGreaterThan(
      positions.get("left")![rank],
    );
    expect(positions.get("left")).not.toEqual(positions.get("right"));
  }
});

test("grows the scrollable canvas for zoom and dragging in either axis", () => {
  const graph: TopologyGraph = {
    nodes: [node("a", true), node("b")],
    edges: [{ id: "ab", source: "a", target: "b", ruleNames: [] }],
  };
  const positions = layoutTopology(graph, "LR");
  const initial = topologyCanvasSize(graph, positions);
  const zoomed = topologyCanvasSize(graph, positions, new Map(), 3);
  expect(zoomed.width).toBeGreaterThan(initial.width);
  expect(zoomed.height).toBeGreaterThan(initial.height);
  const dragged = topologyCanvasSize(
    graph,
    positions,
    new Map([["a", { x: -300, y: -250 }]]),
  );
  expect(dragged.width).toBeGreaterThan(initial.width);
  expect(dragged.height).toBeGreaterThan(initial.height);
  // Zooming back out does not leave an unnecessarily large scroll surface.
  expect(
    topologyCanvasSize(graph, positions, new Map(), 0.5).width,
  ).toBeLessThan(initial.width);
});

test("positions cyclic and disconnected nodes once without adding missing endpoints", () => {
  const graph: TopologyGraph = {
    nodes: [node("a"), node("b"), node("c"), node("d")],
    edges: [
      { id: "ab", source: "a", target: "b", ruleNames: [] },
      { id: "ba", source: "b", target: "a", ruleNames: [] },
      { id: "cd", source: "c", target: "d", ruleNames: [] },
      { id: "unknown", source: "d", target: "missing", ruleNames: [] },
    ],
  };
  const positions = layoutTopology(graph, "LR");
  expect(positions.size).toBe(4);
  expect(positions.has("missing")).toBe(false);
  expect(
    new Set(Array.from(positions.values(), ({ x, y }) => `${x},${y}`)).size,
  ).toBe(4);
});
