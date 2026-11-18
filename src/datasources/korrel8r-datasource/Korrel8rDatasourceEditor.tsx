import { HTTPSettingsEditor } from "@perses-dev/plugin-system";
import type { ReactElement } from "react";
import type { Korrel8rDatasourceSpec } from "./korrel8r-datasource-types";

export interface Korrel8rDatasourceEditorProps {
  value: Korrel8rDatasourceSpec;
  onChange: (next: Korrel8rDatasourceSpec) => void;
  isReadonly?: boolean;
}

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

export function Korrel8rDatasourceEditor({
  value,
  onChange,
  isReadonly,
}: Korrel8rDatasourceEditorProps): ReactElement {
  return (
    <HTTPSettingsEditor
      value={value}
      onChange={onChange}
      isReadonly={isReadonly}
      initialSpecDirect={initialSpecDirect}
      initialSpecProxy={initialSpecProxy}
    />
  );
}
