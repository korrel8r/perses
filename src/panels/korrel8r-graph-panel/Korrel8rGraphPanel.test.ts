import { Korrel8rGraphPanel } from "./Korrel8rGraphPanel";
import { Korrel8rGraphPanelQueryEditor } from "./Korrel8rGraphPanelQueryEditor";
import { Korrel8rGraphPanelSettingsEditor } from "./Korrel8rGraphPanelSettingsEditor";

jest.mock("./Korrel8rGraphPanelComponent", () => ({
  Korrel8rGraphPanelComponent: () => null,
}));
jest.mock("./Korrel8rGraphPanelQueryEditor", () => ({
  Korrel8rGraphPanelQueryEditor: () => null,
}));
jest.mock("./Korrel8rGraphPanelSettingsEditor", () => ({
  Korrel8rGraphPanelSettingsEditor: () => null,
}));

test("can be added without a Perses query type", () => {
  expect(Korrel8rGraphPanel.hideQueryEditor).toBe(true);
  expect(Korrel8rGraphPanel.supportedQueryTypes).toEqual([]);
  expect(Korrel8rGraphPanel.panelOptionsEditorComponents).toEqual([
    { label: "Query", content: Korrel8rGraphPanelQueryEditor },
    { label: "Settings", content: Korrel8rGraphPanelSettingsEditor },
  ]);
  // No depth: new panels use the Korrel8r server default.
  expect(Korrel8rGraphPanel.createInitialOptions()).toEqual({
    mode: "neighbors",
  });
});
