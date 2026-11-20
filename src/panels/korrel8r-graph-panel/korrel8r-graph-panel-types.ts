import type { PanelProps } from "@perses-dev/plugin-system";

// Graph data is not a Perses TimeSeriesData result. The panel manages its
// datasource request directly until a graph-specific query plugin exists.
export interface Korrel8rGraphPanelOptions {
  startQuery?: string;
  mode?: "neighbors" | "goals"; // Defaults to neighbors for existing dashboards.
  goals?: string; // Goal classes separated by commas or newlines.
  depth?: number; // Omit for the Korrel8r default; 0 returns only the start.
  limit?: number; // Maximum results per query; omit for the server default.
  datasourceName?: string; // Omit to select the default Korrel8r datasource.
}

export type Korrel8rGraphPanelProps = PanelProps<Korrel8rGraphPanelOptions>;
