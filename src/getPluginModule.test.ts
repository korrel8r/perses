import { getPluginModule } from "./getPluginModule";

test("uses readable display names without changing resource kinds", () => {
  expect(getPluginModule().spec.plugins).toEqual([
    {
      kind: "Datasource",
      spec: {
        display: { name: "Korrel8r Datasource" },
        name: "Korrel8rDatasource",
      },
    },
    {
      kind: "Panel",
      spec: {
        display: { name: "Korrel8r Graph Panel" },
        name: "Korrel8rGraphPanel",
      },
    },
  ]);
});
