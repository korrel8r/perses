import type { DatasourcePlugin } from "@perses-dev/plugin-system";
import {
  Korrel8rHTTPError,
  Korrel8rResponseError,
} from "./korrel8r-datasource-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isGraph(value: unknown): value is Korrel8rGraph {
  if (!isRecord(value) || !Array.isArray(value.nodes)) return false;
  const validCount = (count: unknown) =>
    typeof count === "number" && Number.isFinite(count);
  const validQueries = (queries: unknown) =>
    queries === undefined ||
    (Array.isArray(queries) &&
      queries.every(
        (query) =>
          isRecord(query) &&
          typeof query.query === "string" &&
          validCount(query.count) &&
          (query.statuses === undefined ||
            (Array.isArray(query.statuses) &&
              query.statuses.every(
                (status: unknown) =>
                  isRecord(status) &&
                  typeof status.status === "string" &&
                  validCount(status.count),
              ))),
      ));
  return (
    value.nodes.every(
      (node: unknown) =>
        isRecord(node) &&
        typeof node.class === "string" &&
        validCount(node.count) &&
        validQueries(node.queries),
    ) &&
    (value.edges === undefined ||
      (Array.isArray(value.edges) &&
        value.edges.every(
          (edge: unknown) =>
            isRecord(edge) &&
            typeof edge.start === "string" &&
            typeof edge.goal === "string" &&
            (edge.rules === undefined ||
              (Array.isArray(edge.rules) &&
                edge.rules.every(
                  (rule: unknown) =>
                    isRecord(rule) && typeof rule.name === "string",
                ))),
        )))
  );
}

const REQUEST_TIMEOUT_MS = 30000;

function requestSignal(signal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error("Korrel8r request timed out")),
    REQUEST_TIMEOUT_MS,
  );
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    },
  };
}
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
    const url = new URL(baseUrl, globalThis.location?.href);
    url.pathname = `${url.pathname.replace(/\/+$/, "")}${path}`;
    url.searchParams.set("rules", "true");
    const bounded = requestSignal(signal);
    let response: Response;
    try {
      response = await globalThis.fetch(
        baseUrl.startsWith("/")
          ? `${url.pathname}${url.search}`
          : url.toString(),
        {
          method: "POST",
          // Proxy credentials and headers are added by Perses server-side.
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: bounded.signal,
        },
      );
    } catch (error) {
      if (bounded.signal.aborted && !signal?.aborted)
        throw new Error("Korrel8r request timed out", { cause: error });
      throw error;
    } finally {
      bounded.cleanup();
    }
    if (!response.ok) {
      const text = await response.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(text) as unknown;
      } catch {
        // Non-JSON errors (including proxy errors) are shown as text.
        errorBody = text;
      }
      throw new Korrel8rHTTPError(
        response.status,
        response.statusText,
        errorBody,
      );
    }
    const result: unknown = await response.json();
    if (!isGraph(result)) throw new Korrel8rResponseError(result);
    return result;
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
