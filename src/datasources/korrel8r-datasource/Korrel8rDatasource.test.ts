import { Korrel8rDatasource } from "./Korrel8rDatasource";
import { Korrel8rHTTPError } from "./korrel8r-datasource-types";

jest.mock("./Korrel8rDatasourceEditor", () => ({
  Korrel8rDatasourceEditor: () => null,
}));

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const originalFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = mockFetch;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});
beforeEach(() => mockFetch.mockReset());

test("posts a neighbors request to the configured Perses proxy", async () => {
  const graph = { nodes: [], edges: [] };
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => graph,
  } as Response);
  const client = Korrel8rDatasource.createClient(
    {},
    { proxyUrl: "/proxy/korrel8r" },
  );
  const start = { queries: ["k8s:Pod:example"], constraint: { limit: 10 } };
  const signal = new AbortController().signal;

  expect(await client.graphNeighbors(start, 2, signal)).toEqual(graph);
  expect(mockFetch).toHaveBeenCalledWith(
    "/proxy/korrel8r/graphs/neighbors?rules=true",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, depth: 2 }),
      signal,
    },
  );
});

test("omits depth when unset and sends an explicit depth of 0", async () => {
  const graph = { nodes: [], edges: [] };
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => graph,
  } as Response);
  const client = Korrel8rDatasource.createClient(
    {},
    { proxyUrl: "/proxy/korrel8r" },
  );
  const start = { queries: ["k8s:Pod:example"] };

  // No depth: Korrel8r picks its own default.
  await client.graphNeighbors(start);
  expect(mockFetch).toHaveBeenLastCalledWith(
    "/proxy/korrel8r/graphs/neighbors?rules=true",
    expect.objectContaining({ body: JSON.stringify({ start }) }),
  );

  // Depth 0: only the start query results, no neighbors.
  await client.graphNeighbors(start, 0);
  expect(mockFetch).toHaveBeenLastCalledWith(
    "/proxy/korrel8r/graphs/neighbors?rules=true",
    expect.objectContaining({ body: JSON.stringify({ start, depth: 0 }) }),
  );
});

test("posts a goal graph request with multiple goal classes", async () => {
  const graph = { nodes: [], edges: [{ start: "mock:foo", goal: "mock:bar" }] };
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => graph,
  } as Response);
  const client = Korrel8rDatasource.createClient(
    {},
    { proxyUrl: "/proxy/korrel8r" },
  );
  const start = { queries: ["mock:foo:x"] };
  const goals = ["mock:bar", "mock:baz"];
  const signal = new AbortController().signal;
  expect(await client.graphGoals(start, goals, signal)).toEqual(graph);
  expect(mockFetch).toHaveBeenCalledWith(
    "/proxy/korrel8r/graphs/goals?rules=true",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ start, goals }),
      signal,
    }),
  );
});

test("preserves the entire JSON body of an unsuccessful goals request", async () => {
  const body = { error: "Forbidden", details: { missing: ["graphs/goals"] } };
  mockFetch.mockResolvedValue({
    ok: false,
    status: 403,
    statusText: "Forbidden",
    text: async () => JSON.stringify(body),
  } as Response);
  const client = Korrel8rDatasource.createClient(
    { directUrl: "https://example.test/api/v1alpha1/" },
    {},
  );
  const request = client.graphGoals({ queries: ["k8s:Pod:example"] }, [
    "log:record",
  ]);
  await expect(request).rejects.toBeInstanceOf(Korrel8rHTTPError);
  await expect(request).rejects.toMatchObject({
    status: 403,
    statusText: "Forbidden",
    body,
  });
  expect(mockFetch).toHaveBeenCalledWith(
    "https://example.test/api/v1alpha1/graphs/goals?rules=true",
    expect.objectContaining({
      body: JSON.stringify({
        start: { queries: ["k8s:Pod:example"] },
        goals: ["log:record"],
      }),
    }),
  );
});

test("preserves non-JSON HTTP errors as text", async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 502,
    statusText: "Bad Gateway",
    text: async () => "upstream unavailable",
  } as Response);
  const client = Korrel8rDatasource.createClient(
    {},
    { proxyUrl: "/proxy/korrel8r" },
  );
  await expect(
    client.graphNeighbors({ queries: ["mock:foo:x"] }, 1),
  ).rejects.toMatchObject({
    status: 502,
    body: "upstream unavailable",
  });
});
