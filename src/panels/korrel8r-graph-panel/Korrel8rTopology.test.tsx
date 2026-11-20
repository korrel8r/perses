import { act, fireEvent, render, screen } from "@testing-library/react";
import type { EChartsCoreOption } from "echarts/core";
import { Korrel8rTopology } from "./Korrel8rTopology";
import { TopologyActionsContext } from "./TopologyActionsContext";
import type { TopologyGraph } from "./toTopologyGraph";

const mockDispatch = jest.fn();
const mockSetOption = jest.fn();
const mockResize = jest.fn();
let mockChartProps: {
  option: EChartsCoreOption;
  onEvents: Record<string, (params: unknown) => void>;
  onRoam: (chart: unknown, event?: { dx?: number; dy?: number }) => void;
  onNodeMoved: (name: string, position: { x: number; y: number }) => void;
};

jest.mock("./TopologyChart", () => ({
  TopologyChart: (props: {
    option: EChartsCoreOption;
    onClick: (params: unknown) => void;
    onContextMenu: (params: unknown) => void;
    onRoam: (chart: unknown, event?: { dx?: number; dy?: number }) => void;
    onNodeMoved: (name: string, position: { x: number; y: number }) => void;
    chart: { current: unknown };
  }) => {
    mockChartProps = {
      option: props.option,
      onEvents: { click: props.onClick, contextmenu: props.onContextMenu },
      onRoam: props.onRoam,
      onNodeMoved: props.onNodeMoved,
    };
    props.chart.current = {
      dispatchAction: mockDispatch,
      setOption: mockSetOption,
      resize: mockResize,
      getOption: () => ({ series: [{ zoom: 1 }] }),
    };
    return <div data-testid="echart" />;
  },
}));

const graph: TopologyGraph = {
  nodes: [
    {
      id: "k8s:Pod.v1",
      label: "k8s:Pod.v1",
      count: 12,
      isStart: true,
      isGoal: false,
      queries: [
        {
          query: "k8s:Pod.v1:one",
          count: 7,
          statuses: [{ status: "warning", count: 2 }],
        },
        {
          query: "k8s:Pod.v1:two",
          count: 5,
          statuses: [
            { status: "error", count: 1 },
            { status: "warning", count: 1 },
          ],
        },
      ],
    },
    {
      id: "log:record",
      label: "log:record",
      count: 2,
      isStart: false,
      isGoal: false,
      queries: [],
    },
  ],
  edges: [
    {
      id: "pod-logs",
      source: "k8s:Pod.v1",
      target: "log:record",
      ruleNames: ["pod logs", "pod events"],
    },
  ],
};

type ChartOption = {
  series: [
    {
      type: string;
      left: string;
      top: string;
      width: number;
      height: number;
      roam: boolean;
      draggable: boolean;
      data: Array<{
        name: string;
        x: number;
        y: number;
        symbol: string;
        symbolSize: number;
      }>;
      links: Array<{ source: string; target: string }>;
      label: {
        formatter: (params: { name: string }) => string;
        rich: { name: { fontSize: number }; count: { fontSize: number } };
      };
    },
  ];
  tooltip: {
    formatter: (params: { name: string; dataType: string }) => HTMLElement;
  };
};
const option = () => mockChartProps.option as ChartOption;

beforeEach(() => {
  mockDispatch.mockClear();
  mockSetOption.mockClear();
});

test("uses Perses EChart's draggable graph with class icons, count badge, and safe tooltips", () => {
  render(<Korrel8rTopology graph={graph} />);
  expect(
    screen.getByRole("img", { name: /2 nodes and 1 edges/ }),
  ).toBeInTheDocument();
  const series = option().series[0];
  expect(series.type).toBe("graph");
  expect(series.roam).toBe(true);
  expect(series.draggable).toBe(true);
  expect([series.left, series.top, series.width]).toEqual([
    "center",
    "center",
    2,
  ]);
  expect(series.height).toBeGreaterThanOrEqual(100);
  expect(series.height).toBeLessThan(200);
  expect(screen.getByRole("img")).toHaveStyle({ overflow: "auto" });
  expect(series.links.length).toBeGreaterThan(1);
  expect(series.links[0]).toMatchObject({
    name: "pod-logs",
    source: "k8s:Pod.v1",
    lineStyle: { curveness: 0 },
    symbol: ["none", "none"],
  });
  expect(series.links.at(-1)).toMatchObject({
    name: "pod-logs",
    target: "log:record",
    symbol: ["none", "arrow"],
  });
  expect(series.data.slice(2)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        symbolSize: 0,
        draggable: false,
        label: { show: false },
      }),
    ]),
  );
  expect(series.label.formatter({ name: "k8s:Pod.v1" })).toBe(
    "{name|Pod} {count|7/12} {name|⋮}",
  );
  const symbol = decodeURIComponent(series.data[0]!.symbol);
  expect(symbol).toContain('viewBox="0 0 512 512"'); // Font Awesome cube for k8s:Pod.v1
  expect(symbol).toContain('<path fill="currentColor"');
  expect(symbol).toContain("M50 45v10"); // start crosshair
  expect(symbol).toContain('<circle cx="14"'); // most severe status marker
  expect(
    option().tooltip.formatter({ dataType: "node", name: "k8s:Pod.v1" })
      .textContent,
  ).toContain("warning: 3");
  expect(
    option().tooltip.formatter({ dataType: "edge", name: "pod-logs:segment:0" })
      .textContent,
  ).toBe("pod logspod events");
});

test("uses distinct Material status icons for error, warning and info badges", () => {
  const statuses = ["error", "warning", "ok"];
  render(
    <Korrel8rTopology
      graph={{
        nodes: statuses.map((status) => ({
          ...graph.nodes[0]!,
          id: status,
          queries: [
            { query: status, count: 1, statuses: [{ status, count: 1 }] },
          ],
        })),
        edges: [],
      }}
    />,
  );
  const symbols = option().series[0].data.map((node) =>
    decodeURIComponent(node.symbol),
  );
  expect(symbols[0]).toContain('d="M12 2C6.48');
  expect(symbols[1]).toContain('d="M1 21h22L12 2');
  expect(symbols[2]).toContain('d="M12 2C6.48');
  expect(symbols[0]).toContain("zm1 15h-2v-2");
  expect(symbols[2]).toContain("zm1 15h-2v-6");
  symbols.forEach((svg) =>
    expect(svg).toContain('transform="translate(6 6) scale(.67)"'),
  );
});

test("direction, zoom and reset controls use the graph chart without navigation", () => {
  const onNodeClick = jest.fn();
  render(<Korrel8rTopology graph={graph} onNodeClick={onNodeClick} />);
  mockChartProps.onEvents.click!({ dataType: "node", name: "k8s:Pod.v1" });
  expect(onNodeClick).toHaveBeenCalledWith(graph.nodes[0]);
  fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
  expect(mockSetOption).toHaveBeenCalledWith({
    series: [expect.objectContaining({ type: "graph", zoom: 1.25 })],
  });
  expect(option().series[0]).toHaveProperty("nodeScaleRatio", 1);
  const before = option().series[0].data[1]!;
  fireEvent.click(
    screen.getByRole("button", { name: "Toggle layout direction" }),
  );
  const after = option().series[0].data[1]!;
  expect(before.x).toBe(0);
  expect(before.y).toBeGreaterThanOrEqual(100);
  expect(after.x).toBeGreaterThan(80);
  expect(after.x).toBeLessThan(150);
  expect(after.y).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Reset View" }));
  expect(mockSetOption).toHaveBeenCalledWith({
    series: [expect.objectContaining({ type: "graph", zoom: 1, center: null })],
  });
  expect(
    screen.getByRole("button", { name: "Fit to Screen" }),
  ).toBeInTheDocument();
});

test("dispatches graph clicks and query selections through optional context actions", () => {
  const onNodeClick = jest.fn();
  const onEdgeClick = jest.fn();
  const onQuerySelect = jest.fn();
  render(
    <TopologyActionsContext.Provider
      value={{ onNodeClick, onEdgeClick, onQuerySelect }}
    >
      <Korrel8rTopology graph={graph} />
    </TopologyActionsContext.Provider>,
  );
  act(() =>
    mockChartProps.onEvents.click!({
      dataType: "node",
      name: graph.nodes[0]!.id,
    }),
  );
  expect(onNodeClick).toHaveBeenCalledWith(graph.nodes[0]);
  act(() =>
    mockChartProps.onEvents.click!({
      dataType: "edge",
      name: graph.edges[0]!.id,
    }),
  );
  expect(onEdgeClick).toHaveBeenCalledWith(graph.edges[0]);
  act(() =>
    mockChartProps.onEvents.click!({
      dataType: "edge",
      name: `${graph.edges[0]!.id}:segment:1`,
    }),
  );
  expect(onEdgeClick).toHaveBeenCalledTimes(2);
  act(() =>
    mockChartProps.onEvents.click!({ dataType: "edge", name: "unknown" }),
  );
  expect(onEdgeClick).toHaveBeenCalledTimes(2);
  act(() =>
    mockChartProps.onEvents.contextmenu!({
      dataType: "node",
      name: graph.nodes[0]!.id,
      event: { event: { preventDefault: jest.fn(), clientX: 20, clientY: 40 } },
    }),
  );
  fireEvent.click(screen.getAllByRole("menuitem")[1]!);
  expect(onQuerySelect).toHaveBeenCalledWith(
    graph.nodes[0],
    graph.nodes[0]!.queries[0],
  );
});

test("resets live chart zoom when a new graph replaces the old one", () => {
  const { rerender } = render(<Korrel8rTopology graph={graph} />);
  fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
  expect(mockSetOption).toHaveBeenLastCalledWith({
    series: [expect.objectContaining({ type: "graph", zoom: 1.25 })],
  });
  rerender(<Korrel8rTopology graph={{ ...graph, edges: [] }} />);
  expect(mockSetOption).toHaveBeenLastCalledWith({
    series: [expect.objectContaining({ type: "graph", zoom: 1, center: null })],
  });
  fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
  expect(mockSetOption).toHaveBeenLastCalledWith({
    series: [expect.objectContaining({ type: "graph", zoom: 1.25 })],
  });
});

test("zoom scales labels along with graph symbols, including wheel zoom", () => {
  render(<Korrel8rTopology graph={graph} />);
  fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
  expect(mockSetOption).toHaveBeenLastCalledWith({
    series: [
      expect.objectContaining({
        type: "graph",
        zoom: 1.25,
        label: expect.objectContaining({
          rich: expect.objectContaining({ name: { fontSize: 15 } }),
        }),
      }),
    ],
  });
  act(() =>
    mockChartProps.onRoam({
      getOption: () => ({ series: [{ zoom: 2 }] }),
      setOption: mockSetOption,
    }),
  );
  expect(mockSetOption).toHaveBeenLastCalledWith({
    series: [
      expect.objectContaining({
        label: expect.objectContaining({
          rich: expect.objectContaining({ name: { fontSize: 24 } }),
        }),
      }),
    ],
  });
});

test("fits both directions to a small viewport by shrinking nodes and labels", () => {
  render(<Korrel8rTopology graph={graph} />);
  const viewport = screen.getByRole("img");
  jest
    .spyOn(viewport, "getBoundingClientRect")
    .mockReturnValue({ width: 100, height: 90 } as DOMRect);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(option().series[0].height).toBeLessThan(86);
  expect(option().series[0].data[0]!.symbolSize).toBeLessThan(64);
  expect(option().series[0].label.rich.name.fontSize).toBeLessThan(12);
  fireEvent.click(
    screen.getByRole("button", { name: "Toggle layout direction" }),
  );
  expect(option().series[0].width).toBeLessThan(100);
  expect(option().series[0].label.rich.count.fontSize).toBeLessThan(11);
});

test("measures panel resizes through the native ResizeObserver", () => {
  const original = globalThis.ResizeObserver;
  let measure!: ResizeObserverCallback;
  const disconnect = jest.fn();
  const observe = jest.fn();
  globalThis.ResizeObserver = class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      measure = callback;
    }
    observe = observe;
    disconnect = disconnect;
    unobserve = jest.fn();
  };
  try {
    const { unmount } = render(<Korrel8rTopology graph={graph} />);
    const viewport = screen.getByRole("img");
    jest
      .spyOn(viewport, "getBoundingClientRect")
      .mockReturnValue({ width: 100, height: 90 } as DOMRect);
    act(() => measure([], {} as ResizeObserver));
    expect(observe).toHaveBeenCalledWith(viewport);
    expect(option().series[0].data[0]!.symbolSize).toBeLessThan(64);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  } finally {
    globalThis.ResizeObserver = original;
  }
});

test("updates the scroll surface on zoom and after dragging a node", () => {
  render(<Korrel8rTopology graph={graph} />);
  const canvas = screen.getByRole("img").firstElementChild!;
  const initialClass = canvas.className;
  fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
  expect(canvas.className).not.toBe(initialClass);
  act(() =>
    mockChartProps.onRoam({
      getOption: () => ({ series: [{ zoom: 3 }] }),
      setOption: mockSetOption,
    }),
  );
  expect(canvas.className).not.toBe(initialClass);
  const bendBefore = option().series[0].data[2]!;
  act(() => mockChartProps.onNodeMoved("log:record", { x: -500, y: -300 }));
  expect(canvas.className).not.toBe(initialClass);
  expect(option().series[0].data[2]).not.toMatchObject({
    x: bendBefore.x,
    y: bendBefore.y,
  });
  expect(option().series[0].data[0]).toMatchObject({ x: 0, y: 0 });
  expect(option().series[0].data[1]).toMatchObject({ x: -500, y: -300 });
  fireEvent.click(screen.getByRole("button", { name: "Reset View" }));
  expect(option().series[0].data[1]).not.toMatchObject({ x: -500, y: -300 });
  expect(canvas.className).toBe(initialClass);
});

test("pans at a stable size, then exposes scrollbars on mouse release outside the viewport", () => {
  render(<Korrel8rTopology graph={graph} />);
  const viewport = screen.getByRole("img");
  jest
    .spyOn(viewport, "getBoundingClientRect")
    .mockReturnValue({ width: 120, height: 100 } as DOMRect);
  act(() => window.dispatchEvent(new Event("resize")));
  const canvas = viewport.firstElementChild!;
  const initialClass = canvas.className;
  act(() =>
    mockChartProps.onRoam(
      { getOption: () => ({ series: [{ zoom: 1 }] }) },
      { dx: 100, dy: -75 },
    ),
  );
  act(() =>
    mockChartProps.onRoam(
      { getOption: () => ({ series: [{ zoom: 1 }] }) },
      { dx: 100, dy: -75 },
    ),
  );
  // No canvas resize while the pointer is down: ECharts retains its center.
  expect(canvas.className).toBe(initialClass);
  act(() => window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true })));
  expect(canvas.className).not.toBe(initialClass);
  expect(viewport.scrollLeft).toBeGreaterThan(0);
  expect(viewport.scrollTop).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Reset View" }));
  expect(canvas.className).toBe(initialClass);
});

test("reset cancels an unfinished graph pan", () => {
  render(<Korrel8rTopology graph={graph} />);
  const canvas = screen.getByRole("img").firstElementChild!;
  const initialClass = canvas.className;
  act(() =>
    mockChartProps.onRoam(
      { getOption: () => ({ series: [{ zoom: 1 }] }) },
      { dx: 200, dy: 100 },
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset View" }));
  act(() => window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true })));
  expect(canvas.className).toBe(initialClass);
});

test("fit to screen keeps dragged nodes but reset view restores the layout", () => {
  render(<Korrel8rTopology graph={graph} />);
  const viewport = screen.getByRole("img");
  jest
    .spyOn(viewport, "getBoundingClientRect")
    .mockReturnValue({ width: 120, height: 100 } as DOMRect);
  act(() => window.dispatchEvent(new Event("resize")));
  act(() => mockChartProps.onNodeMoved("log:record", { x: 450, y: 300 }));
  const before = option().series[0].data[1]!;
  expect(before).toMatchObject({ x: 450, y: 300 });
  fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
  viewport.scrollLeft = 90;
  viewport.scrollTop = 70;
  fireEvent.click(screen.getByRole("button", { name: "Fit to Screen" }));
  expect(viewport.scrollLeft).toBe(0);
  expect(viewport.scrollTop).toBe(0);
  expect(mockSetOption).toHaveBeenCalledWith({
    series: [expect.objectContaining({ type: "graph", zoom: 1, center: null })],
  });
  expect(option().series[0].data[1]).toMatchObject({ x: 450, y: 300 });
  expect(option().series[0]).toHaveProperty("zoom", 1);
  expect(option().series[0].data[1]!.symbolSize).toBeLessThan(
    before.symbolSize,
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset View" }));
  expect(option().series[0].data[1]).toMatchObject({ x: 0, y: 136 });
});

test("right-click menu shows sorted queries; callbacks are optional and never navigate", () => {
  const onQuerySelect = jest.fn();
  render(<Korrel8rTopology graph={graph} onQuerySelect={onQuerySelect} />);
  const preventDefault = jest.fn();
  act(() =>
    mockChartProps.onEvents.contextmenu!({
      dataType: "node",
      name: "k8s:Pod.v1",
      event: { event: { preventDefault, clientX: 20, clientY: 40 } },
    }),
  );
  expect(preventDefault).toHaveBeenCalled();
  expect(screen.getByText("k8s:Pod.v1")).toBeInTheDocument();
  const entries = screen.getAllByRole("menuitem");
  expect(entries).toHaveLength(3);
  expect(entries[1]).toHaveTextContent("k8s:Pod.v1:one");
  fireEvent.click(entries[2]!);
  expect(onQuerySelect).toHaveBeenCalledWith(
    graph.nodes[0],
    graph.nodes[0]!.queries[1],
  );
});

test("parallel links follow distinct Dagre routes and unavailable nodes have no actions", () => {
  const unavailable: TopologyGraph = {
    nodes: [
      { ...graph.nodes[0]!, unavailableReason: "Destination disabled" },
      graph.nodes[1]!,
    ],
    edges: [graph.edges[0]!, { ...graph.edges[0]!, id: "another" }],
  };
  const onNodeClick = jest.fn();
  const onQuerySelect = jest.fn();
  render(
    <Korrel8rTopology
      graph={unavailable}
      onNodeClick={onNodeClick}
      onQuerySelect={onQuerySelect}
    />,
  );
  const routed = option().series[0];
  const paths = ["pod-logs", "another"].map((id) =>
    (routed.links as Array<{ name?: string; target: string }>).filter(
      (link) => link.name === id,
    ),
  );
  expect(paths[0]!.length).toBeGreaterThan(1);
  expect(paths[1]!.length).toBeGreaterThan(1);
  expect(paths[0]!.map((link) => link.target)).not.toEqual(
    paths[1]!.map((link) => link.target),
  );
  const waypointPositions = routed.data
    .slice(2)
    .map(({ x, y }: { x: number; y: number }) => [x, y]);
  expect(
    new Set(waypointPositions.map((point: number[]) => point.join(","))).size,
  ).toBeGreaterThan(1);
  expect(
    option().series[0].label.formatter({ name: "k8s:Pod.v1" }),
  ).not.toContain("⋮");
  mockChartProps.onEvents.click!({ dataType: "node", name: "k8s:Pod.v1" });
  expect(onNodeClick).not.toHaveBeenCalled();
  act(() =>
    mockChartProps.onEvents.contextmenu!({
      dataType: "node",
      name: "k8s:Pod.v1",
      event: { event: { preventDefault: jest.fn(), clientX: 20, clientY: 40 } },
    }),
  );
  expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  expect(screen.getByText("k8s:Pod.v1")).toBeInTheDocument();
  expect(
    option().tooltip.formatter({ dataType: "node", name: "k8s:Pod.v1" })
      .textContent,
  ).toContain("Destination disabled");
});

test("API strings in tooltips are treated as text, not HTML", () => {
  const malicious: TopologyGraph = {
    nodes: [
      {
        ...graph.nodes[0]!,
        id: "<img src=x onerror=alert(1)>",
        label: "<img src=x onerror=alert(1)>",
      },
    ],
    edges: [],
  };
  render(<Korrel8rTopology graph={malicious} />);
  const tooltip = option().tooltip.formatter({
    dataType: "node",
    name: malicious.nodes[0]!.id,
  });
  expect(tooltip.querySelector("img")).toBeNull();
  expect(tooltip.textContent).toContain("<img src=x onerror=alert(1)>");
});
