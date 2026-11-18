import type { PanelPlugin } from "@perses-dev/plugin-system";
import { Korrel8rGraphPanelComponent } from "./Korrel8rGraphPanelComponent";
import type {
  Korrel8rGraphPanelOptions,
  Korrel8rGraphPanelProps,
} from "./korrel8r-graph-panel-types";
import { Korrel8rGraphPanelQueryEditor } from "./Korrel8rGraphPanelQueryEditor";
import { Korrel8rGraphPanelSettingsEditor } from "./Korrel8rGraphPanelSettingsEditor";

export const Korrel8rGraphPanel: PanelPlugin<
  Korrel8rGraphPanelOptions,
  Korrel8rGraphPanelProps
> = {
  PanelComponent: Korrel8rGraphPanelComponent,
  panelOptionsEditorComponents: [
    { label: "Query", content: Korrel8rGraphPanelQueryEditor },
    { label: "Settings", content: Korrel8rGraphPanelSettingsEditor },
  ],
  // This Query tab edits the panel spec, not Perses's built-in query model:
  // no built-in Perses query type returns Korrel8r graphs.
  hideQueryEditor: true,
  supportedQueryTypes: [],
  // Leave depth unset so new panels use the Korrel8r server default.
  createInitialOptions: () => ({ mode: "neighbors" }),
};
