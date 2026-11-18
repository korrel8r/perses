import { TextField } from "@mui/material";
import { OptionsEditorGroup } from "@perses-dev/components";
import type { OptionsEditorProps } from "@perses-dev/plugin-system";
import type { ReactElement } from "react";
import type { Korrel8rGraphPanelOptions } from "./korrel8r-graph-panel-types";

export function Korrel8rGraphPanelSettingsEditor({
  value,
  onChange,
}: OptionsEditorProps<Korrel8rGraphPanelOptions>): ReactElement {
  return (
    <OptionsEditorGroup title="Korrel8r datasource">
      <TextField
        label="Korrel8r datasource name"
        value={value.datasourceName ?? ""}
        helperText="Leave blank to use the default Korrel8r datasource"
        onChange={(e) =>
          onChange({ ...value, datasourceName: e.target.value || undefined })
        }
        fullWidth
      />
    </OptionsEditorGroup>
  );
}
