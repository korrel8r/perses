import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useDatasourceStore, useTimeRange } from "@perses-dev/plugin-system";
import { Korrel8rHTTPError } from "../../datasources/korrel8r-datasource/korrel8r-datasource-types";
import { Korrel8rGraphPanelComponent } from "./Korrel8rGraphPanelComponent";

// ECharts needs a real canvas; panel tests exercise data flow, not chart rendering.
const mockSetOption = jest.fn();
jest.mock("./TopologyChart", () => ({
  TopologyChart: ({ chart }: { chart: { current: unknown } }) => {
    chart.current = { setOption: mockSetOption };
    return <div />;
  },
}));

jest.mock("@perses-dev/plugin-system", () => ({
  useDatasourceStore: jest.fn(),
  useTimeRange: jest.fn(),
}));

const graphNeighbors = jest.fn();
const graphGoals = jest.fn();
const getDatasourceClient = jest.fn();

beforeEach(() => {
  graphNeighbors.mockReset();
  graphGoals.mockReset();
  mockSetOption.mockClear();
  getDatasourceClient
    .mockReset()
    .mockResolvedValue({ graphNeighbors, graphGoals });
  (useDatasourceStore as jest.Mock).mockReturnValue({ getDatasourceClient });
  (useTimeRange as jest.Mock).mockReturnValue({
    absoluteTimeRange: {
      start: new Date("2025-01-01T00:00:00Z"),
      end: new Date("2025-01-01T01:00:00Z"),
    },
  });
});

function showPanel(
  spec: {
    startQuery?: string;
    depth?: number;
    limit?: number;
    datasourceName?: string;
    mode?: "neighbors" | "goals";
    goals?: string;
  },
  contentDimensions?: { width: number; height: number },
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Korrel8rGraphPanelComponent
        spec={spec}
        queryResults={[]}
        contentDimensions={contentDimensions}
      />
    </QueryClientProvider>,
  );
}

test("waits for a query before requesting a graph", () => {
  showPanel({ depth: 1 });
  expect(screen.getByRole("status")).toHaveTextContent("Set a Korrel8r query");
  expect(getDatasourceClient).not.toHaveBeenCalled();
});

test("shows progress while the first graph request is pending", async () => {
  let resolveGraph!: (graph: { nodes: []; edges: [] }) => void;
  graphNeighbors.mockReturnValue(
    new Promise((resolve) => {
      resolveGraph = resolve;
    }),
  );
  showPanel({ startQuery: "mock:foo:x" });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading Korrel8r graph",
  );
  expect(
    screen.getByRole("progressbar", { name: "Loading Korrel8r graph" }),
  ).toBeInTheDocument();
  await waitFor(() => expect(graphNeighbors).toHaveBeenCalledTimes(1));

  await act(async () => resolveGraph({ nodes: [], edges: [] }));
  await waitFor(() =>
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(),
  );
});

test("shows progress while refreshing an existing graph", async () => {
  let resolveRefresh!: (graph: { nodes: []; edges: [] }) => void;
  graphNeighbors
    .mockResolvedValueOnce({ nodes: [], edges: [] })
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Korrel8rGraphPanelComponent
        spec={{ startQuery: "mock:foo:x" }}
        queryResults={[]}
      />
    </QueryClientProvider>,
  );
  await screen.findByText("Full Korrel8r JSON response");
  act(() => {
    void client.invalidateQueries(["query", "Korrel8rGraphPanel"]);
  });
  expect(
    await screen.findByRole("progressbar", { name: "Loading Korrel8r graph" }),
  ).toBeInTheDocument();
  // The previous graph remains visible until the new result arrives.
  expect(screen.getByText("Full Korrel8r JSON response")).toBeInTheDocument();
  await act(async () => resolveRefresh({ nodes: [], edges: [] }));
  await waitFor(() =>
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(),
  );
});

test("fetches neighbors in the dashboard time range and displays JSON", async () => {
  const graph = {
    nodes: [{ class: "mock:foo", count: 1 }],
    edges: [],
    extra: { nested: ["response fields are not dropped"] },
  };
  graphNeighbors.mockResolvedValue(graph);
  showPanel({ startQuery: " mock:foo:x ", depth: 2, datasourceName: "local" });

  const json = await screen.findByText(/"class": "mock:foo"/);
  expect(json.textContent).toBe(JSON.stringify(graph, null, 2));
  expect(
    screen.getByRole("img", { name: /1 nodes and 0 edges/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zoom In" })).toBeInTheDocument();
  expect(getDatasourceClient).toHaveBeenCalledWith({
    kind: "Korrel8rDatasource",
    name: "local",
  });
  expect(graphNeighbors).toHaveBeenCalledWith(
    {
      queries: ["mock:foo:x"],
      constraint: {
        start: "2025-01-01T00:00:00.000Z",
        end: "2025-01-01T01:00:00.000Z",
      },
    },
    2,
    expect.any(AbortSignal),
  );
  expect(graphGoals).not.toHaveBeenCalled();
});

test("preserves the topology view when the panel rerenders without new data", async () => {
  const graph = { nodes: [{ class: "mock:foo", count: 1 }], edges: [] };
  graphNeighbors.mockResolvedValue(graph);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const panel = (height: number) => (
    <QueryClientProvider client={client}>
      <Korrel8rGraphPanelComponent
        spec={{ startQuery: "mock:foo:x" }}
        queryResults={[]}
        contentDimensions={{ width: 300, height }}
      />
    </QueryClientProvider>
  );
  const { rerender } = render(panel(180));
  await screen.findByRole("img");
  fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
  expect(mockSetOption).toHaveBeenLastCalledWith({
    series: [expect.objectContaining({ type: "graph", zoom: 1.25 })],
  });
  rerender(panel(200));
  fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
  expect(mockSetOption).toHaveBeenLastCalledWith({
    series: [expect.objectContaining({ type: "graph", zoom: 1.5625 })],
  });
});

test("fits the graph within Perses panel dimensions", async () => {
  graphNeighbors.mockResolvedValue({
    nodes: [{ class: "mock:foo", count: 1 }],
    edges: [],
  });
  showPanel({ startQuery: "mock:foo:x" }, { width: 260, height: 180 });
  const graph = await screen.findByRole("img");
  expect(graph.parentElement?.parentElement?.parentElement).toHaveStyle({
    height: "180px",
    width: "100%",
  });
});

test("requests a goal-directed graph with multiple goal classes", async () => {
  const graph = {
    nodes: [
      { class: "mock:foo", count: 1 },
      { class: "mock:bar", count: 1 },
    ],
    edges: [{ start: "mock:foo", goal: "mock:bar" }],
  };
  graphGoals.mockResolvedValue(graph);
  showPanel({
    mode: "goals",
    startQuery: "mock:foo:x",
    goals: "mock:bar, mock:baz\nmock:qux",
  });

  const json = await screen.findByText(/"goal": "mock:bar"/);
  expect(json.textContent).toBe(JSON.stringify(graph, null, 2));
  expect(
    screen.getByRole("img", { name: /2 nodes and 1 edges/ }),
  ).toBeInTheDocument();
  expect(graphGoals).toHaveBeenCalledWith(
    {
      queries: ["mock:foo:x"],
      constraint: {
        start: "2025-01-01T00:00:00.000Z",
        end: "2025-01-01T01:00:00.000Z",
      },
    },
    ["mock:bar", "mock:baz", "mock:qux"],
    expect.any(AbortSignal),
  );
  expect(graphNeighbors).not.toHaveBeenCalled();
});

test("applies an optional result limit and omits an unset depth", async () => {
  graphNeighbors.mockResolvedValue({ nodes: [], edges: [] });
  showPanel({ startQuery: "mock:foo:x", limit: 25 });
  await screen.findByText("Full Korrel8r JSON response");
  expect(graphNeighbors).toHaveBeenCalledWith(
    {
      queries: ["mock:foo:x"],
      constraint: {
        start: "2025-01-01T00:00:00.000Z",
        end: "2025-01-01T01:00:00.000Z",
        limit: 25,
      },
    },
    undefined, // Korrel8r applies its own default depth.
    expect.any(AbortSignal),
  );
});

test("requests depth 0 to show only the start query results", async () => {
  // Korrel8r omits empty lists, so a single-node graph has no "edges" field.
  graphNeighbors.mockResolvedValue({
    nodes: [{ class: "mock:foo", count: 1 }],
  });
  showPanel({ startQuery: "mock:foo:x", depth: 0 });
  expect(
    await screen.findByRole("img", { name: /1 nodes and 0 edges/ }),
  ).toBeInTheDocument();
  await screen.findByText("Full Korrel8r JSON response");
  expect(graphNeighbors).toHaveBeenCalledWith(
    expect.anything(),
    0,
    expect.any(AbortSignal),
  );
});

test("refetches neighbors when depth changes from 0 to 3", async () => {
  graphNeighbors
    .mockResolvedValueOnce({ nodes: [{ class: "mock:foo", count: 1 }] })
    .mockResolvedValueOnce({
      nodes: [
        { class: "mock:foo", count: 1 },
        { class: "mock:bar", count: 1 },
      ],
      edges: [{ start: "mock:foo", goal: "mock:bar" }],
    });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const panel = (depth: number) => (
    <QueryClientProvider client={client}>
      <Korrel8rGraphPanelComponent
        spec={{ startQuery: "mock:foo:x", depth }}
        queryResults={[]}
      />
    </QueryClientProvider>
  );
  const { rerender } = render(panel(0));
  expect(
    await screen.findByRole("img", { name: /1 nodes and 0 edges/ }),
  ).toBeInTheDocument();
  rerender(panel(3));
  expect(
    await screen.findByRole("img", { name: /2 nodes and 1 edges/ }),
  ).toBeInTheDocument();
  expect(graphNeighbors.mock.calls.map((call) => call[1])).toEqual([0, 3]);
});

test("ignores goal classes in neighbors mode", async () => {
  graphNeighbors.mockResolvedValue({ nodes: [], edges: [] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const panel = (goals: string) => (
    <QueryClientProvider client={client}>
      <Korrel8rGraphPanelComponent
        spec={{ startQuery: "mock:foo:x", goals }}
        queryResults={[]}
      />
    </QueryClientProvider>
  );
  const { rerender } = render(panel("mock:bar"));
  await screen.findByText("Full Korrel8r JSON response");

  rerender(panel("mock:baz"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(graphNeighbors).toHaveBeenCalledTimes(1);
});

test("ignores the unused neighbor depth in goals mode", async () => {
  graphGoals.mockResolvedValue({ nodes: [], edges: [] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const panel = (depth: number) => (
    <QueryClientProvider client={client}>
      <Korrel8rGraphPanelComponent
        spec={{
          mode: "goals",
          startQuery: "mock:foo:x",
          goals: "mock:bar",
          depth,
        }}
        queryResults={[]}
      />
    </QueryClientProvider>
  );
  const { rerender } = render(panel(1));
  expect(
    await screen.findByText("Full Korrel8r JSON response"),
  ).toBeInTheDocument();

  rerender(panel(5));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(graphGoals).toHaveBeenCalledTimes(1);
});

test("renders an empty graph message while retaining the JSON response", async () => {
  graphNeighbors.mockResolvedValue({ nodes: [], edges: [] });
  showPanel({ startQuery: "mock:foo:x" });
  expect(
    await screen.findByText("No nodes found in the Korrel8r graph."),
  ).toHaveAttribute("role", "status");
  expect(screen.getByText("Full Korrel8r JSON response")).toBeInTheDocument();
});

test.each([undefined, null])(
  "shows only an informational Empty graph message when nodes are %s",
  async (nodes) => {
    graphNeighbors.mockResolvedValue({
      nodes,
      error: "private backend details",
    });
    showPanel({ startQuery: "mock:foo:x" });
    expect(await screen.findByText("Empty graph")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveClass("MuiAlert-standardInfo");
    expect(status.querySelector("svg")).not.toBeNull();
    expect(status).toHaveTextContent(/^Empty graph$/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/private backend details/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Full Korrel8r JSON response"),
    ).not.toBeInTheDocument();
  },
);

test("waits for goal classes before requesting a goal graph", () => {
  showPanel({ mode: "goals", startQuery: "mock:foo:x", goals: "  , \n" });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Set at least one goal class",
  );
  expect(getDatasourceClient).not.toHaveBeenCalled();
});

test("displays the complete JSON body of an HTTP error", async () => {
  const body = { error: "Bad request", details: { invalid: ["start"] } };
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  try {
    graphNeighbors.mockRejectedValue(
      new Korrel8rHTTPError(400, "Bad Request", body),
    );
    showPanel({ startQuery: "mock:foo:x" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("HTTP 400 Bad Request");
    expect(alert.querySelector("pre")?.textContent).toBe(
      JSON.stringify(body, null, 2),
    );
  } finally {
    consoleError.mockRestore();
  }
});

test("explains an OpenShift route 503 without hiding its raw response", async () => {
  const body = "<html><h1>Application is not available</h1></html>";
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  try {
    graphNeighbors.mockRejectedValue(
      new Korrel8rHTTPError(503, "Service Unavailable", body),
    );
    showPanel({ startQuery: "mock:foo:x" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Korrel8r is unavailable (HTTP 503)");
    expect(alert).toHaveTextContent("Check the datasource URL");
    expect(alert).toHaveTextContent("Full server response");
    expect(alert.querySelector("pre")?.textContent).toBe(
      JSON.stringify(body, null, 2),
    );
  } finally {
    consoleError.mockRestore();
  }
});

test("shows non-HTTP errors as JSON too", async () => {
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  try {
    getDatasourceClient.mockRejectedValue(new Error("No Korrel8r datasource"));
    showPanel({ startQuery: "mock:foo:x" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No Korrel8r datasource",
    );
  } finally {
    consoleError.mockRestore();
  }
});
