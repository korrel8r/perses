// Only the demo federation entry imports this file. Never persist callbacks in the panel spec.
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useState } from "react";
import type { ReactElement } from "react";
import { Korrel8rGraphPanel as productionPanel } from "../src/panels/korrel8r-graph-panel/Korrel8rGraphPanel";
import { Korrel8rGraphPanelComponent } from "../src/panels/korrel8r-graph-panel/Korrel8rGraphPanelComponent";
import type { Korrel8rGraphPanelProps } from "../src/panels/korrel8r-graph-panel/korrel8r-graph-panel-types";
import { TopologyActionsContext } from "../src/panels/korrel8r-graph-panel/TopologyActionsContext";

export * from "../src/panels/korrel8r-graph-panel";

export function DemoPanelComponent(
  props: Korrel8rGraphPanelProps,
): ReactElement {
  const [popup, setPopup] = useState<{ title: string; value: unknown } | null>(
    null,
  );
  const close = () => setPopup(null);
  return (
    <TopologyActionsContext.Provider
      value={{
        onNodeClick: (node) => setPopup({ title: "Node click", value: node }),
        onEdgeClick: (edge) => setPopup({ title: "Edge click", value: edge }),
        onQuerySelect: (node, query) =>
          setPopup({ title: "Query selected", value: { node, query } }),
      }}
    >
      <Korrel8rGraphPanelComponent {...props} />
      <Dialog
        open={popup !== null}
        onClose={close}
        maxWidth="md"
        fullWidth
        aria-labelledby="demo-click-title"
      >
        <DialogTitle id="demo-click-title">{popup?.title}</DialogTitle>
        <DialogContent dividers>
          <Box
            component="pre"
            sx={{
              overflow: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {popup ? JSON.stringify(popup.value, null, 2) : ""}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Close</Button>
        </DialogActions>
      </Dialog>
    </TopologyActionsContext.Provider>
  );
}

// Keep the production plugin metadata and editors; replace only its component.
export const Korrel8rGraphPanel: typeof productionPanel = {
  ...productionPanel,
  PanelComponent: DemoPanelComponent,
};
