import { nodeIcon } from "./nodeIcon";

test("uses exact versioned class icons before domain icons", () => {
  expect(nodeIcon("k8s:Pod.v1")).toContain('viewBox="0 0 512 512"');
  expect(nodeIcon("k8s:Pod.v1")).not.toBe(nodeIcon("k8s:Unknown.v1"));
  expect(nodeIcon("k8s:Pod.v2")).toBe(nodeIcon("k8s:Unknown.v1"));
  expect(nodeIcon("k8s:Service.v1")).not.toBe(nodeIcon("k8s:Unknown.v1"));
});

test("uses domain icons and a generic fallback", () => {
  expect(nodeIcon("log:application")).not.toBe(nodeIcon("metric:cpu"));
  expect(nodeIcon("other:thing")).toBe(nodeIcon("unknown:thing"));
  expect(nodeIcon("k8s:Unknown.v1")).not.toBe(nodeIcon("unknown:thing"));
});
