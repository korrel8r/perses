import { createConfig } from "../rsbuild.config";

// Explicit demo-only build: the default rsbuild.config.ts never includes this entry.
export default createConfig("./demo/Korrel8rGraphPanelDemo.tsx");
