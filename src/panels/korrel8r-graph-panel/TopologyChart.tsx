import { GraphChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { init, use } from "echarts/core";
import type { ECharts, EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReactElement, MutableRefObject } from "react";

// Perses EChart does not register GraphChart, forward graphroam payloads or
// observe container resizes. Keep this small adapter so graph registration and
// initialization use the same ECharts core in a federated host.
use([GraphChart, TooltipComponent, CanvasRenderer]);

interface GraphTarget {
  type?: string;
  draggable?: boolean | "horizontal" | "vertical";
  x?: number;
  y?: number;
  parent?: GraphTarget;
}

export interface GraphEvent {
  dataType?: string;
  name?: string;
  event?: {
    event?: { clientX?: number; clientY?: number; preventDefault: () => void };
    target?: GraphTarget;
  };
}

/** Follow ZRender's captured drag, including mouse release outside the canvas. */
export function listenForNodeDrags(
  instance: ECharts,
  onMoved: (name: string, position: { x: number; y: number }) => void,
): void {
  let draggedNode: string | undefined;
  instance.on("mousedown", (event) => {
    draggedNode = event.dataType === "node" ? event.name : undefined;
  });
  instance.getZr().on("dragend", (event) => {
    // ZRender drags the child image/path. ECharts stores the position on
    // its parent Symbol group; the child's x/y remain at (0, 0).
    const target = event.target as GraphTarget | undefined;
    const group = target?.draggable ? target.parent : target;
    if (
      draggedNode &&
      group &&
      Number.isFinite(group.x) &&
      Number.isFinite(group.y)
    ) {
      onMoved(draggedNode, { x: group.x!, y: group.y! });
    }
    draggedNode = undefined;
  });
}

export function TopologyChart({
  option,
  chart,
  onClick,
  onContextMenu,
  onRoam,
  onNodeMoved,
}: {
  option: EChartsCoreOption;
  chart: MutableRefObject<ECharts | undefined>;
  onClick: (event: GraphEvent) => void;
  onContextMenu: (event: GraphEvent) => void;
  onRoam: (instance: ECharts, event?: { dx?: number; dy?: number }) => void;
  onNodeMoved: (name: string, position: { x: number; y: number }) => void;
}): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const events = useRef({ onClick, onContextMenu, onRoam, onNodeMoved });
  events.current = { onClick, onContextMenu, onRoam, onNodeMoved };

  useLayoutEffect(() => {
    if (!container.current) return;
    const instance = init(container.current);
    chart.current = instance;
    instance.on("click", (event) => events.current.onClick(event));
    instance.on("contextmenu", (event) => events.current.onContextMenu(event));
    instance.on("graphroam", (event) =>
      events.current.onRoam(instance, event as { dx?: number; dy?: number }),
    );
    // ECharts mouseup loses its node target outside the canvas; ZRender dragend
    // retains it through pointer capture.
    listenForNodeDrags(instance, (name, position) =>
      events.current.onNodeMoved(name, position),
    );
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => instance.resize());
    observer?.observe(container.current);
    return () => {
      observer?.disconnect();
      instance.dispose();
      chart.current = undefined;
    };
  }, [chart]);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [chart, option]);

  return <div ref={container} style={{ width: "100%", height: "100%" }} />;
}
