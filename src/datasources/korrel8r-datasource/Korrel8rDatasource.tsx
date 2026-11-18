import type { DatasourcePlugin } from "@perses-dev/plugin-system";
import { Korrel8rHTTPError } from "./korrel8r-datasource-types";
import type {
  GraphStart,
  Korrel8rDatasourceClient,
  Korrel8rDatasourceSpec,
  Korrel8rGraph,
} from "./korrel8r-datasource-types";
import { Korrel8rDatasourceEditor } from "./Korrel8rDatasourceEditor";

// Configure the datasource URL to point at the Korrel8r API v1alpha1 root.
const createClient: DatasourcePlugin<
  Korrel8rDatasourceSpec,
  Korrel8rDatasourceClient
>["createClient"] = (spec, options) => {
  const baseUrl = spec.directUrl || options.proxyUrl;
  if (!baseUrl)
    throw new Error("Configure a Korrel8r direct URL or HTTP proxy");

  const request = async (
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Korrel8rGraph> => {
    // Perses's fetch helper throws for non-2xx responses and discards their
    // structured bodies. Use the browser fetch to preserve the full JSON.
    const response = await globalThis.fetch(
      `${baseUrl.replace(/\/$/, "")}${path}?rules=true`,
      {
        method: "POST",
        // Perses's proxy adds the datasource's configured headers and secret
        // server-side; the browser must not send them itself.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );
    if (!response.ok) {
      const text = await response.text();
      let errorBody: unknown = text;
      if (text) {
        try {
          errorBody = JSON.parse(text) as unknown;
        } catch {
          // Non-JSON errors (including proxy errors) are shown as text.
        }
      }
      throw new Korrel8rHTTPError(
        response.status,
        response.statusText,
        errorBody,
      );
    }
    return (await response.json()) as Korrel8rGraph;
  };

  return {
    graphNeighbors: (start: GraphStart, depth?: number, signal?: AbortSignal) =>
      // An omitted depth leaves the default to Korrel8r; 0 is a valid request.
      request(
        "/graphs/neighbors",
        depth === undefined ? { start } : { start, depth },
        signal,
      ),
    graphGoals: (start: GraphStart, goals: string[], signal?: AbortSignal) =>
      request("/graphs/goals", { start, goals }, signal),
  };
};

export const Korrel8rDatasource: DatasourcePlugin<
  Korrel8rDatasourceSpec,
  Korrel8rDatasourceClient
> = {
  createClient,
  OptionsEditorComponent: Korrel8rDatasourceEditor,
  createInitialOptions: () => ({ directUrl: "" }),
};
