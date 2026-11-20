/** @jest-environment node */
import { Korrel8rDatasource } from "./Korrel8rDatasource";

// Use Node's real HTTP fetch against a local Korrel8r server. No cluster,
// Console proxy, or browser CORS required.
jest.mock("./Korrel8rDatasourceEditor", () => ({
  Korrel8rDatasourceEditor: () => null,
}));

const baseUrl = process.env.KORREL8R_TEST_URL;
const liveTest = baseUrl ? test : test.skip;

liveTest(
  "retrieves mock neighbor nodes, edge and rule from Korrel8r",
  async () => {
    const client = Korrel8rDatasource.createClient({ directUrl: baseUrl }, {});
    const graph = await client.graphNeighbors({ queries: ["mock:foo:x"] }, 1);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ class: "mock:foo", count: 1 }),
        expect.objectContaining({ class: "mock:bar", count: 1 }),
      ]),
    );
    expect(graph.edges).toEqual([
      expect.objectContaining({
        start: "mock:foo",
        goal: "mock:bar",
        rules: expect.arrayContaining([
          expect.objectContaining({ name: "foobar" }),
        ]),
      }),
    ]);
  },
);

liveTest(
  "distinguishes depth 0 from depth 3 for correlated mock data",
  async () => {
    const client = Korrel8rDatasource.createClient({ directUrl: baseUrl }, {});
    const start = { queries: ["mock:foo:x"] };
    const zero = await client.graphNeighbors(start, 0);
    const three = await client.graphNeighbors(start, 3);

    expect(zero.nodes.map((node) => node.class)).toEqual(["mock:foo"]);
    expect(zero.edges ?? []).toHaveLength(0);
    expect(three.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ start: "mock:foo", goal: "mock:bar" }),
      ]),
    );
  },
);

liveTest("retrieves mock goal-directed graph", async () => {
  const client = Korrel8rDatasource.createClient({ directUrl: baseUrl }, {});
  const graph = await client.graphGoals({ queries: ["mock:foo:x"] }, [
    "mock:bar",
  ]);
  expect(graph.edges).toEqual([
    expect.objectContaining({ start: "mock:foo", goal: "mock:bar" }),
  ]);
});
