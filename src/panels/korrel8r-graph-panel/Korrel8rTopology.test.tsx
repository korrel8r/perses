import { render, screen } from "@testing-library/react";
import { Korrel8rTopology } from "./Korrel8rTopology";

test("shows directed links, rules, counts, statuses and start/goal labels", () => {
  const { container } = render(
    <Korrel8rTopology
      graph={{
        nodes: [
          {
            id: "mock:foo",
            label: "mock:foo",
            count: 2,
            isStart: true,
            isGoal: false,
            queries: [
              {
                query: "mock:foo:x",
                count: 2,
                statuses: [{ status: "ok", count: 2 }],
              },
            ],
          },
          {
            id: "mock:bar",
            label: "mock:bar",
            count: 1,
            isStart: false,
            isGoal: true,
            queries: [],
          },
        ],
        edges: [
          {
            id: "foo-bar",
            source: "mock:foo",
            target: "mock:bar",
            ruleNames: ["foobar"],
          },
        ],
      }}
    />,
  );
  expect(
    screen.getByRole("img", { name: /2 nodes and 1 edges/ }),
  ).toBeInTheDocument();
  expect(screen.getByText("mock:foo (start)")).toBeInTheDocument();
  expect(screen.getByText("mock:bar (goal)")).toBeInTheDocument();
  expect(screen.getByText("ok: 2")).toBeInTheDocument();
  expect(screen.getByText("foobar")).toBeInTheDocument();
  expect(container.querySelectorAll("circle")).toHaveLength(2);
  const link = container.querySelector("path[marker-end]");
  expect(link?.getAttribute("d")).toMatch(/^M .* L /);
  expect(link?.getAttribute("marker-end")).toMatch(/^url\(#.+\)$/);
});

test("centers a single node", () => {
  const { container } = render(
    <Korrel8rTopology
      graph={{
        nodes: [
          {
            id: "mock:foo",
            label: "mock:foo",
            count: 1,
            queries: [],
            isStart: true,
            isGoal: false,
          },
        ],
        edges: [],
      }}
    />,
  );
  expect(container.querySelector("circle")).toHaveAttribute("cx", "160");
  expect(container.querySelector("svg")).toHaveAttribute(
    "viewBox",
    "0 0 320 320",
  );
});

test("shortens long class names but keeps them in the node title", () => {
  const label = "netflow:network:a-very-long-class-name";
  const { container } = render(
    <Korrel8rTopology
      graph={{
        nodes: [
          {
            id: label,
            label,
            count: 3,
            queries: [],
            isStart: false,
            isGoal: false,
          },
        ],
        edges: [],
      }}
    />,
  );
  expect(screen.getByText("netflow:network:a-very-…")).toBeInTheDocument();
  expect(container.querySelector("title")?.textContent).toBe(
    `${label}: 3 results`,
  );
});

test("scales larger logical layouts to the available viewport", () => {
  const graph = {
    nodes: Array.from({ length: 8 }, (_, index) => ({
      id: `mock:${index}`,
      label: `mock:${index}`,
      count: 1,
      queries: [],
      isStart: false,
      isGoal: false,
    })),
    edges: [],
  };
  render(<Korrel8rTopology graph={graph} />);
  const svg = screen.getByRole("img");
  // Square layout: the ring grows with the node count, not the panel shape.
  expect(svg).toHaveAttribute("viewBox", "0 0 506 506");
  expect(svg).toHaveAttribute("width", "100%");
  expect(svg).toHaveAttribute("height", "100%");
  expect(svg).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
});

test("uses distinct arrow markers when multiple panels are rendered", () => {
  const graph = { nodes: [], edges: [] };
  const { container } = render(
    <>
      <Korrel8rTopology graph={graph} />
      <Korrel8rTopology graph={graph} />
    </>,
  );
  const markers = Array.from(container.querySelectorAll("marker"));
  expect(markers[0]?.id).not.toBe(markers[1]?.id);
});
