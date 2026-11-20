import { fireEvent, render, screen } from "@testing-library/react";
import { Korrel8rGraphPanelSettingsEditor } from "./Korrel8rGraphPanelSettingsEditor";

test("selects a named datasource without replacing query options", () => {
  const onChange = jest.fn();
  render(
    <Korrel8rGraphPanelSettingsEditor
      value={{ startQuery: "mock:foo:x", mode: "neighbors", depth: 2 }}
      onChange={onChange}
    />,
  );
  expect(screen.queryByLabelText("Graph mode")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Korrel8r datasource name/), {
    target: { value: "local" },
  });
  expect(onChange).toHaveBeenCalledWith({
    startQuery: "mock:foo:x",
    mode: "neighbors",
    depth: 2,
    datasourceName: "local",
  });
});
