import { HTTPSettingsEditor } from "@perses-dev/plugin-system";
import type { OptionsEditorProps } from "@perses-dev/plugin-system";
import type { ReactElement } from "react";
import type { Korrel8rDatasourceSpec } from "./korrel8r-datasource-types";

const initialSpecDirect: Korrel8rDatasourceSpec = { directUrl: "" };
const initialSpecProxy: Korrel8rDatasourceSpec = {
  proxy: {
    kind: "HTTPProxy",
    spec: {
      allowedEndpoints: [
        { endpointPattern: "/graphs/neighbors", method: "POST" },
        { endpointPattern: "/graphs/goals", method: "POST" },
      ],
      url: "",
    },
  },
};

export function Korrel8rDatasourceEditor(
  props: OptionsEditorProps<Korrel8rDatasourceSpec>,
): ReactElement {
  return (
    <HTTPSettingsEditor
      {...props}
      initialSpecDirect={initialSpecDirect}
      initialSpecProxy={initialSpecProxy}
    />
  );
}
