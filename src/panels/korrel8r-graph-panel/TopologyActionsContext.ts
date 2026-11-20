import { createContext } from "react";
import type { TopologyActions } from "./Korrel8rTopology";

/** Optional runtime actions supplied by an embedding application, not dashboard JSON. */
export const TopologyActionsContext = createContext<TopologyActions>({});
