import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { Korrel8rGraphPanelOptions } from "./korrel8r-graph-panel-types";
import { Korrel8rGraphPanelQueryEditor } from "./Korrel8rGraphPanelQueryEditor";

function Editor({
  initial = { depth: 2 },
  onEdit,
}: {
  initial?: Korrel8rGraphPanelOptions;
  onEdit?: (value: Korrel8rGraphPanelOptions) => void;
}) {
  const [value, setValue] = useState<Korrel8rGraphPanelOptions>(initial);
  return (
    <Korrel8rGraphPanelQueryEditor
      value={value}
      onChange={(next) => {
        onEdit?.(next);
        setValue(next);
      }}
    />
  );
}

test("switches between neighbor depth and goal classes without losing options", () => {
  render(<Editor />);
  expect(screen.getByLabelText("Neighbor depth")).toHaveValue(2);
  fireEvent.change(screen.getByLabelText("Korrel8r query"), {
    target: { value: "mock:foo:x" },
  });
  expect(screen.getByLabelText("Korrel8r query")).toHaveValue("mock:foo:x");

  fireEvent.change(screen.getByLabelText("Graph mode"), {
    target: { value: "goals" },
  });
  expect(screen.queryByLabelText("Neighbor depth")).not.toBeInTheDocument();
  const goals = screen.getByLabelText(/Goal classes/);
  fireEvent.change(goals, { target: { value: "mock:bar, mock:baz" } });
  expect(goals).toHaveValue("mock:bar, mock:baz");

  fireEvent.change(screen.getByLabelText("Graph mode"), {
    target: { value: "neighbors" },
  });
  expect(screen.getByLabelText("Neighbor depth")).toHaveValue(2);
});

test("keeps the persisted depth a whole number, blank for the server default", () => {
  const onEdit = jest.fn();
  render(<Editor onEdit={onEdit} />);
  const depth = screen.getByLabelText("Neighbor depth");

  // Blank clears the option so the request omits depth; 0 is a valid depth,
  // and invalid or negative input must never reach the panel spec.
  fireEvent.change(depth, { target: { value: "" } });
  expect(onEdit).toHaveBeenLastCalledWith({ depth: undefined });
  expect(depth).toHaveValue(null);
  fireEvent.change(depth, { target: { value: "0" } });
  expect(onEdit).toHaveBeenLastCalledWith({ depth: 0 });
  expect(depth).toHaveValue(0);
  fireEvent.change(depth, { target: { value: "-3" } });
  expect(onEdit).toHaveBeenLastCalledWith({ depth: 0 });
  fireEvent.change(depth, { target: { value: "3" } });
  expect(onEdit).toHaveBeenLastCalledWith({ depth: 3 });
});

test("sets an optional result limit and clears it when blank", () => {
  const onEdit = jest.fn();
  render(<Editor initial={{ depth: 1 }} onEdit={onEdit} />);
  const limit = screen.getByLabelText("Result limit");
  expect(limit).toHaveValue(null); // Blank means the server default.

  fireEvent.change(limit, { target: { value: "50" } });
  expect(onEdit).toHaveBeenLastCalledWith({ depth: 1, limit: 50 });
  fireEvent.change(limit, { target: { value: "" } });
  expect(onEdit).toHaveBeenLastCalledWith({ depth: 1, limit: undefined });
  expect(limit).toHaveValue(null);
});

test("labels stay bound to their own inputs when two editors are open", () => {
  render(
    <>
      <Korrel8rGraphPanelQueryEditor
        value={{ startQuery: "a" }}
        onChange={jest.fn()}
      />
      <Korrel8rGraphPanelQueryEditor
        value={{ startQuery: "b" }}
        onChange={jest.fn()}
      />
    </>,
  );
  const queries = screen.getAllByLabelText("Korrel8r query");
  expect(queries.map((input) => (input as HTMLInputElement).value)).toEqual([
    "a",
    "b",
  ]);
  expect(queries[0]!.id).not.toBe(queries[1]!.id);
});
