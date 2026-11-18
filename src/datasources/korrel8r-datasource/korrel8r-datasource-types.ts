import type { HTTPProxy } from "@perses-dev/core";
import type { DatasourceClient } from "@perses-dev/plugin-system";

export interface Korrel8rDatasourceSpec {
  directUrl?: string;
  proxy?: HTTPProxy;
}

// Minimal Korrel8r graph API shapes. Extend these as the renderer is implemented.
// Korrel8r omits edges when there are none (for example a single-node graph).
export interface Korrel8rGraph {
  nodes: Array<{
    class: string;
    count: number;
    queries?: Array<{
      query: string;
      count: number;
      statuses?: Array<{ status: string; count: number }>;
    }>;
  }>;
  edges?: Array<{
    start: string;
    goal: string;
    rules?: Array<{ name: string }>;
  }>;
}

export interface GraphStart {
  queries: string[];
  constraint?: { start?: string; end?: string; limit?: number };
}

/** Preserves the entire response body for non-2xx graph requests. */
export class Korrel8rHTTPError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown,
  ) {
    super(`Korrel8r request failed: ${status} ${statusText}`);
    this.name = "Korrel8rHTTPError";
  }
}

export interface Korrel8rDatasourceClient extends DatasourceClient {
  /** Omit depth to use the Korrel8r server default; 0 returns only the start. */
  graphNeighbors(
    start: GraphStart,
    depth?: number,
    signal?: AbortSignal,
  ): Promise<Korrel8rGraph>;
  graphGoals(
    start: GraphStart,
    goals: string[],
    signal?: AbortSignal,
  ): Promise<Korrel8rGraph>;
}
