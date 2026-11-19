/** @jest-environment node */
import { init, use } from "echarts/core";
import type { ECharts } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { Theme } from "@mui/material";
import { listenForNodeDrags } from "./TopologyChart";
import {
  layoutTopology,
  layoutTopologyWithRoutes,
  topologyCanvasSize,
  topologySpan,
} from "./topologyLayout";
import { topologyOption } from "./topologyOption";
import type { TopologyGraph } from "./toTopologyGraph";

test("real ECharts retains edge callback names and renders Dagre-routed segments", () => {
  use([SVGRenderer]);
  const graph: TopologyGraph = {
    nodes: ["a", "b"].map((id) => ({
      id,
      label: id,
      count: 1,
      isStart: false,
      isGoal: false,
      queries: [],
    })),
    edges: [
      { id: "first", source: "a", target: "b", ruleNames: ["rule"] },
      { id: "second", source: "a", target: "b", ruleNames: [] },
    ],
  };
  const { positions, routes } = layoutTopologyWithRoutes(graph, "TB");
  const palette = {
    text: { primary: "#222", secondary: "#888", disabled: "#aaa" },
    background: { paper: "#fff" },
    primary: { main: "#00f", contrastText: "#fff" },
  } as Theme["palette"];
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width: 400,
    height: 400,
  });
  try {
    chart.setOption(topologyOption(graph, positions, 1, 1, palette, routes));
    const model = (
      chart as unknown as {
        getModel: () => { getSeriesByIndex: (index: number) => unknown };
      }
    )
      .getModel()
      .getSeriesByIndex(0) as {
      getGraph: () => {
        edgeData: { count: () => number; getName: (index: number) => string };
        getEdgeByIndex: (index: number) => {
          getVisual: (name: string) => string;
        };
      };
    };
    const edgeData = model.getGraph().edgeData;
    expect(edgeData.count()).toBeGreaterThan(2);
    expect(
      Array.from({ length: edgeData.count() }, (_, i) => edgeData.getName(i)),
    ).toEqual(expect.arrayContaining(["first:segment:0", "second:segment:0"]));
    const routedGraph = model.getGraph();
    for (let i = 0; i < edgeData.count(); i++) {
      expect(routedGraph.getEdgeByIndex(i).getVisual("toSymbol")).toBe(
        edgeData.getName(i).endsWith(":segment:0") ? "none" : "arrow",
      );
    }
    expect(chart.renderToSVGString()).toContain("<path");
  } finally {
    chart.dispose();
  }
});

test("tracks a node after dragging it beyond the canvas edge", () => {
  type Handler = (event: {
    name?: string;
    dataType?: string;
    target?: {
      x: number;
      y: number;
      draggable?: boolean;
      parent?: { x: number; y: number };
    };
  }) => void;
  const chartHandlers = new Map<string, Handler>();
  const zrHandlers = new Map<string, Handler>();
  const instance = {
    on: (name: string, handler: Handler) => chartHandlers.set(name, handler),
    getZr: () => ({
      on: (name: string, handler: Handler) => zrHandlers.set(name, handler),
    }),
  } as unknown as ECharts;
  const moved = jest.fn();
  listenForNodeDrags(instance, moved);
  chartHandlers.get("mousedown")!({ name: "k8s:Pod.v1", dataType: "node" });
  zrHandlers.get("dragend")!({
    target: { draggable: true, x: 0, y: 0, parent: { x: -400, y: 600 } },
  });
  expect(moved).toHaveBeenCalledWith("k8s:Pod.v1", { x: -400, y: 600 });
  zrHandlers.get("dragend")!({ target: { x: 0, y: 0 } });
  expect(moved).toHaveBeenCalledTimes(1);
});

// A canvas mock hides missing chart registrations. Render a real ECharts graph
// without a browser to catch a blank chart if GraphChart isn't installed.
test("registers the graph series on the same ECharts core that renders it", () => {
  use([SVGRenderer]);
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width: 320,
    height: 200,
  });
  try {
    chart.setOption({
      series: [
        {
          type: "graph",
          layout: "none",
          roam: true,
          data: [
            { id: "a", name: "Pod", x: 0, y: 0, symbolSize: 40 },
            { id: "b", name: "Log", x: 100, y: 0, symbolSize: 40 },
          ],
          links: [{ source: "a", target: "b" }],
          label: { show: true },
        },
      ],
    });
    const roam = jest.fn();
    chart.on("graphroam", roam);
    chart.dispatchAction({ type: "graphRoam", seriesIndex: 0, dx: 1, dy: 0 });
    expect(roam).toHaveBeenCalledWith(
      expect.objectContaining({ dx: 1, dy: 0 }),
    );
    const svg = chart.renderToSVGString();
    expect(svg).toContain("Pod");
    expect(svg).toContain("Log");
    expect(svg).toContain("<path");
  } finally {
    chart.dispose();
  }
});

test("ECharts drags the symbol's parent while the child stays at the origin", () => {
  use([SVGRenderer]);
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width: 200,
    height: 200,
  });
  try {
    chart.setOption({
      series: [
        {
          type: "graph",
          layout: "none",
          draggable: true,
          data: [
            { name: "root", x: 0, y: 0 },
            { name: "neighbor", x: 0, y: 86 },
          ],
        },
      ],
    });
    const series = (
      chart as unknown as {
        getModel: () => {
          getSeriesByIndex: (index: number) => {
            getData: () => {
              getItemGraphicEl: (index: number) => {
                childAt: (index: number) => {
                  x: number;
                  y: number;
                  parent: { x: number; y: number; updateTransform: () => void };
                  drift: (dx: number, dy: number) => void;
                };
              };
            };
          };
        };
      }
    )
      .getModel()
      .getSeriesByIndex(0);
    const symbol = series.getData().getItemGraphicEl(1).childAt(0);
    const originalY = symbol.parent.y;
    symbol.parent.updateTransform(); // SSR has no paint pass to initialize transform.
    symbol.drift(20, 30);
    expect(symbol.y).toBe(0);
    expect(symbol.parent.y).toBe(originalY + 30);
  } finally {
    chart.dispose();
  }
});

test("fits a layered graph to a small viewport without clipping the last label", () => {
  use([SVGRenderer]);
  const graph: TopologyGraph = {
    nodes: ["First", "Middle", "Last"].map((id) => ({
      id,
      label: id,
      count: 1,
      isStart: false,
      isGoal: false,
      queries: [],
    })),
    edges: [
      { id: "first-middle", source: "First", target: "Middle", ruleNames: [] },
      { id: "middle-last", source: "Middle", target: "Last", ruleNames: [] },
    ],
  };
  const positions = layoutTopology(graph, "TB");
  const natural = topologyCanvasSize(graph, positions);
  const fit = Math.min(1, 100 / natural.width, 80 / natural.height);
  const span = topologySpan(positions);
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width: 100,
    height: 80,
  });
  try {
    chart.setOption({
      series: [
        {
          type: "graph",
          layout: "none",
          left: "center",
          top: "center",
          width: Math.max(2, span.width) * fit,
          height: Math.max(2, span.height) * fit,
          data: graph.nodes.map(({ id }) => ({
            id,
            name: id,
            ...positions.get(id),
            symbolSize: 64 * fit,
          })),
          label: {
            show: true,
            position: "bottom",
            distance: Math.round(fit),
            fontSize: Math.max(1, Math.round(12 * fit)),
          },
        },
      ],
    });
    const svg = chart.renderToSVGString();
    const last = svg.match(
      /transform="translate\([^ ]+ ([^)]+)\)"[^>]*>Last<\/text>/,
    );
    expect(last).not.toBeNull();
    expect(Number(last![1])).toBeLessThan(76);
    const circle = svg.match(/matrix\(([^,]+),0,0,([^,]+),/);
    expect(Number(circle?.[1])).toBeLessThan(32);
    expect(circle?.[1]).toBe(circle?.[2]);
  } finally {
    chart.dispose();
  }
});

test.each(["LR", "TB"] as const)(
  "keeps %s labels and circular symbols inside the padded canvas",
  (direction) => {
    use([SVGRenderer]);
    const graph: TopologyGraph = {
      nodes: ["First", "Second", "Last"].map((id, index) => ({
        id,
        label: id,
        count: 1,
        isStart: index === 0,
        isGoal: false,
        queries: [],
      })),
      edges: [
        {
          id: "first-second",
          source: "First",
          target: "Second",
          ruleNames: [],
        },
        { id: "second-last", source: "Second", target: "Last", ruleNames: [] },
      ],
    };
    const positions = layoutTopology(graph, direction);
    const size = topologyCanvasSize(graph, positions);
    const span = topologySpan(positions);
    const chart = init(null, undefined, {
      renderer: "svg",
      ssr: true,
      ...size,
    });
    try {
      chart.setOption({
        series: [
          {
            type: "graph",
            layout: "none",
            left: "center",
            top: "center",
            width: Math.max(2, span.width),
            height: Math.max(2, span.height),
            data: graph.nodes.map(({ id }) => ({
              id,
              name: id,
              ...positions.get(id),
              symbolSize: 64,
            })),
            links: graph.edges,
            label: { show: true, position: "bottom" },
          },
        ],
      });
      const svg = chart.renderToSVGString();
      const labels = Array.from(
        svg.matchAll(
          /transform="translate\(([^ ]+) ([^)]+)\)"[^>]*>(First|Second|Last)<\/text>/g,
        ),
      );
      expect(labels).toHaveLength(3);
      labels.forEach((match) => {
        expect(Number(match[1])).toBeGreaterThan(0);
        expect(Number(match[1])).toBeLessThan(size.width);
        expect(Number(match[2])).toBeGreaterThan(0);
        expect(Number(match[2])).toBeLessThan(size.height - 12);
      });
      // ECharts must not stretch circles into ellipses when the graph is flat.
      const circle = svg.match(/matrix\(([^,]+),0,0,([^,]+),/);
      expect(circle?.[1]).toBe(circle?.[2]);
    } finally {
      chart.dispose();
    }
  },
);
