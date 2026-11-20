import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { TopologyActionsContext } from "../src/panels/korrel8r-graph-panel/TopologyActionsContext";
import {
  DemoPanelComponent,
  Korrel8rGraphPanel,
} from "./Korrel8rGraphPanelDemo";

const node = { id: "<node>", count: 2 };
const edge = { id: "node->other", ruleNames: ["rule"] };
const query = { query: "k8s:Pod:{}", count: 2 };

jest.mock(
  "../src/panels/korrel8r-graph-panel/Korrel8rGraphPanelComponent",
  () => ({
    Korrel8rGraphPanelComponent: () => {
      const actions = useContext(TopologyActionsContext);
      return (
        <>
          <button onClick={() => actions.onNodeClick?.(node as never)}>
            Node
          </button>
          <button onClick={() => actions.onEdgeClick?.(edge as never)}>
            Edge
          </button>
          <button
            onClick={() =>
              actions.onQuerySelect?.(node as never, query as never)
            }
          >
            Query
          </button>
        </>
      );
    },
  }),
);

test("demo replaces only the panel component and shows callback arguments as text", async () => {
  expect(Korrel8rGraphPanel.PanelComponent).toBe(DemoPanelComponent);
  render(<DemoPanelComponent spec={{}} queryResults={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Node" }));
  expect(screen.getByRole("dialog").querySelector("pre")?.textContent).toBe(
    JSON.stringify(node, null, 2),
  );
  expect(screen.getByRole("dialog").querySelector("node")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edge" }));
  expect(screen.getByRole("dialog").querySelector("pre")?.textContent).toBe(
    JSON.stringify(edge, null, 2),
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Query" }));
  expect(screen.getByRole("dialog").querySelector("pre")?.textContent).toBe(
    JSON.stringify({ node, query }, null, 2),
  );
});
