import {
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  SvgIcon,
  Tooltip,
  useTheme,
} from "@mui/material";
import type { ECharts } from "echarts/core";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactElement } from "react";
import type {
  TopologyEdge,
  TopologyGraph,
  TopologyNode,
} from "./toTopologyGraph";
import { TopologyActionsContext } from "./TopologyActionsContext";
import {
  severity,
  topologyLabelMetrics,
  topologyOption,
} from "./topologyOption";
import {
  layoutTopologyWithRoutes,
  routeSegmentId,
  topologyCanvasSize,
} from "./topologyLayout";
import type { LayoutDirection } from "./topologyLayout";
import { TopologyChart } from "./TopologyChart";

export interface TopologyActions {
  onNodeClick?: (node: TopologyNode) => void;
  onEdgeClick?: (edge: TopologyEdge) => void;
  onQuerySelect?: (
    node: TopologyNode,
    query: TopologyNode["queries"][number],
  ) => void;
}

function graphZoom(instance: ECharts): number {
  const series = instance.getOption().series;
  return Array.isArray(series)
    ? ((series[0] as { zoom?: number }).zoom ?? 1)
    : 1;
}

export function Korrel8rTopology({
  graph,
  onNodeClick,
  onEdgeClick,
  onQuerySelect,
}: { graph: TopologyGraph } & TopologyActions): ReactElement {
  const theme = useTheme();
  const actions = useContext(TopologyActionsContext);
  const chart = useRef<ECharts>();
  const viewport = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const fitting = useRef(false);
  const [direction, setDirection] = useState<LayoutDirection>("TB");
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const pendingPan = useRef({ x: 0, y: 0 });
  const [moved, setMoved] = useState<
    ReadonlyMap<string, { x: number; y: number }>
  >(() => new Map());
  const [fittedPositions, setFittedPositions] = useState<ReadonlyMap<
    string,
    { x: number; y: number }
  > | null>(null);
  const [copyStatus, setCopyStatus] = useState<{
    query: string;
    message: string;
  } | null>(null);
  const [menu, setMenu] = useState<{
    node: TopologyNode;
    x: number;
    y: number;
  } | null>(null);
  const nodes = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const edges = useMemo(
    () => new Map(graph.edges.map((edge) => [edge.id, edge])),
    [graph.edges],
  );
  const layout = useMemo(
    () => layoutTopologyWithRoutes(graph, direction),
    [graph, direction],
  );
  const positions = layout.positions;
  const segments = useMemo(() => {
    const result = new Map<string, TopologyEdge>();
    for (const edge of graph.edges) {
      const count = Math.max(1, (layout.routes.get(edge.id)?.length ?? 2) - 1);
      for (let index = 0; index < count; index++) {
        result.set(routeSegmentId(edge.id, index), edge);
      }
    }
    return result;
  }, [graph.edges, layout.routes]);
  const routed = useMemo(
    () =>
      new Map(
        Array.from(layout.routes, ([id, points]) => {
          const edge = edges.get(id);
          const start = edge && positions.get(edge.source);
          const end = edge && positions.get(edge.target);
          const startMoved = edge && moved.get(edge.source);
          const endMoved = edge && moved.get(edge.target);
          return [
            id,
            points.map((point, index) => {
              const t = points.length < 2 ? 0.5 : index / (points.length - 1);
              return {
                x:
                  point.x +
                  (1 - t) *
                    ((startMoved?.x ?? start?.x ?? 0) - (start?.x ?? 0)) +
                  t * ((endMoved?.x ?? end?.x ?? 0) - (end?.x ?? 0)),
                y:
                  point.y +
                  (1 - t) *
                    ((startMoved?.y ?? start?.y ?? 0) - (start?.y ?? 0)) +
                  t * ((endMoved?.y ?? end?.y ?? 0) - (end?.y ?? 0)),
              };
            }),
          ];
        }),
      ),
    [layout.routes, edges, moved, positions],
  );
  const displayedPositions = useMemo(
    () => new Map([...positions, ...moved]),
    [positions, moved],
  );
  const fitBase = fittedPositions ?? positions;
  const naturalSize = useMemo(
    () =>
      topologyCanvasSize(
        graph,
        fitBase,
        fitBase,
        1,
        (fittedPositions ? routed : layout.routes).values(),
      ),
    [graph, fitBase, fittedPositions, routed, layout.routes],
  );
  const fitScale =
    viewportSize.width && viewportSize.height
      ? Math.min(
          1,
          viewportSize.width / naturalSize.width,
          viewportSize.height / naturalSize.height,
        )
      : 1;
  const fitScaleRef = useRef(fitScale);
  fitScaleRef.current = fitScale;
  const canvasSize = useMemo(() => {
    // After fitting, measure subsequent drags from that fitted arrangement,
    // not from the original layout (which may be far away).
    const size = topologyCanvasSize(
      graph,
      fitBase,
      displayedPositions,
      zoomLevel,
      routed.values(),
    );
    // ECharts pans inside its own canvas. Extend the scroll surface on both
    // sides of the pan so nodes remain reachable after leaving the viewport.
    return {
      width: Math.ceil(
        Math.max(viewportSize.width, size.width * fitScale) +
          2 * Math.abs(panOffset.x),
      ),
      height: Math.ceil(
        Math.max(viewportSize.height, size.height * fitScale) +
          2 * Math.abs(panOffset.y),
      ),
    };
  }, [
    graph,
    fitBase,
    displayedPositions,
    zoomLevel,
    fitScale,
    viewportSize,
    panOffset,
    routed,
  ]);
  useEffect(() => {
    // Resizing the ECharts canvas on every pan step moves its center beneath
    // the pointer. Let ECharts pan at a fixed size; grow the scroll surface
    // once the gesture ends, including when the pointer is released outside.
    const finishPan = () => {
      setPanOffset((current) =>
        current.x === pendingPan.current.x && current.y === pendingPan.current.y
          ? current
          : { ...pendingPan.current },
      );
    };
    window.addEventListener("pointerup", finishPan, true);
    window.addEventListener("mouseup", finishPan, true);
    return () => {
      window.removeEventListener("pointerup", finishPan, true);
      window.removeEventListener("mouseup", finishPan, true);
    };
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width && height)
        setViewportSize((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    if (observer) {
      observer.observe(element);
      return () => observer.disconnect();
    }
    // Older browsers and test environments without ResizeObserver.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const previousSize = useRef(canvasSize);
  useLayoutEffect(() => {
    if (viewport.current) {
      if (fitting.current) {
        viewport.current.scrollLeft = 0;
        viewport.current.scrollTop = 0;
      } else {
        viewport.current.scrollLeft +=
          (canvasSize.width - previousSize.current.width) / 2;
        viewport.current.scrollTop +=
          (canvasSize.height - previousSize.current.height) / 2;
      }
    }
    fitting.current = false;
    previousSize.current = canvasSize;
  }, [canvasSize]);
  // Keep ECharts' own roam/zoom as the source of truth. React state only
  // sizes the scroll surface; the chart handles symbol transforms itself.
  const updateZoom = useCallback(
    (next: number, resetCenter = false, instance = chart.current) => {
      zoomRef.current = next;
      instance?.setOption({
        series: [
          {
            type: "graph",
            zoom: next,
            ...(resetCenter ? { center: null } : {}),
            label: topologyLabelMetrics(fitScaleRef.current, next),
          },
        ],
      });
      setZoomLevel(next);
    },
    [],
  );
  const resetZoom = useCallback(() => {
    updateZoom(1, true);
    pendingPan.current = { x: 0, y: 0 };
    setPanOffset({ x: 0, y: 0 });
  }, [updateZoom]);
  useEffect(() => {
    // The chart may already have received an option built with the previous
    // zoom; reset its live zoom as well as the ref and canvas state.
    resetZoom();
    setMoved(new Map());
    setFittedPositions(null);
  }, [graph, direction, resetZoom]);
  const option = useMemo(
    () =>
      topologyOption(
        graph,
        displayedPositions,
        fitScale,
        zoomRef.current,
        theme.palette,
        routed,
      ),
    [graph, displayedPositions, fitScale, theme.palette, routed],
  );

  const zoom = (factor: number) =>
    updateZoom(Math.max(0.2, Math.min(5, zoomRef.current * factor)));
  // Fit the current (possibly dragged) arrangement without moving nodes.
  const fitToScreen = () => {
    fitting.current = true;
    resetZoom();
    setFittedPositions(new Map(displayedPositions));
    if (viewport.current) {
      viewport.current.scrollLeft = 0;
      viewport.current.scrollTop = 0;
    }
  };
  // Restore the calculated layout and default view.
  const resetView = () => {
    resetZoom();
    setMoved(new Map());
    setFittedPositions(null);
  };
  return (
    <Box
      sx={{ position: "relative", width: "100%", height: "100%", minHeight: 0 }}
    >
      <Box
        ref={viewport}
        role="img"
        aria-label={`Korrel8r graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges`}
        sx={{ width: "100%", height: "100%", overflow: "auto" }}
      >
        <Box
          sx={{
            width: `max(100%, ${canvasSize.width}px)`,
            height: `max(100%, ${canvasSize.height}px)`,
          }}
        >
          <TopologyChart
            option={option}
            chart={chart}
            onRoam={(instance, event) => {
              const next = graphZoom(instance);
              if (next !== zoomRef.current) updateZoom(next, false, instance);
              if (event?.dx || event?.dy) {
                pendingPan.current.x += event.dx ?? 0;
                pendingPan.current.y += event.dy ?? 0;
              }
            }}
            onNodeMoved={(name, position) =>
              setMoved((previous) => new Map(previous).set(name, position))
            }
            onClick={(params) => {
              if (params.dataType === "edge") {
                const edge =
                  segments.get(params.name ?? "") ??
                  edges.get(params.name ?? "");
                if (edge) (onEdgeClick ?? actions.onEdgeClick)?.(edge);
                return;
              }
              if (params.dataType !== "node") return;
              const node = nodes.get(params.name ?? "");
              if (!node || node.unavailableReason) return;
              // Clicking the label opens query choices; clicking the icon
              // delegates node selection to the embedding application.
              if (
                node.queries.length > 1 &&
                params.event?.target?.type === "text" &&
                params.event.event
              ) {
                setCopyStatus(null);
                setMenu({
                  node,
                  x: params.event.event.clientX ?? 0,
                  y: params.event.event.clientY ?? 0,
                });
              } else {
                (onNodeClick ?? actions.onNodeClick)?.(node);
              }
            }}
            onContextMenu={(params) => {
              if (params.dataType !== "node") return;
              const node = nodes.get(params.name ?? "");
              const event = params.event?.event;
              if (node && event) {
                event.preventDefault();
                setCopyStatus(null);
                setMenu({ node, x: event.clientX ?? 0, y: event.clientY ?? 0 });
              }
            }}
          />
        </Box>
      </Box>
      <Stack
        direction="row"
        sx={{
          position: "absolute",
          right: 4,
          top: 4,
          bgcolor: "background.paper",
          borderRadius: 1,
          boxShadow: 1,
        }}
      >
        <Tooltip title="Zoom In">
          <IconButton
            size="small"
            aria-label="Zoom In"
            onClick={() => zoom(1.25)}
          >
            +
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom Out">
          <IconButton
            size="small"
            aria-label="Zoom Out"
            onClick={() => zoom(0.8)}
          >
            −
          </IconButton>
        </Tooltip>
        <Tooltip title="Fit to Screen">
          <IconButton
            size="small"
            aria-label="Fit to Screen"
            onClick={fitToScreen}
          >
            ⊡
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset View">
          <IconButton size="small" aria-label="Reset View" onClick={resetView}>
            ↺
          </IconButton>
        </Tooltip>
        <Tooltip title="Toggle layout direction">
          <IconButton
            size="small"
            aria-label="Toggle layout direction"
            onClick={() =>
              setDirection((value) => (value === "LR" ? "TB" : "LR"))
            }
          >
            ⇄
          </IconButton>
        </Tooltip>
      </Stack>
      <Menu
        open={menu !== null}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
        PaperProps={{ sx: { maxWidth: "min(480px, calc(100vw - 32px))" } }}
      >
        {menu && (
          <MenuItem disabled sx={{ minWidth: 0 }}>
            <Box
              sx={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {menu.node.id}
            </Box>
          </MenuItem>
        )}
        {!menu?.node.unavailableReason &&
          menu?.node.queries
            .slice()
            .sort((a, b) => b.count - a.count)
            .map((query) => (
              <Tooltip key={query.query} title={query.query} placement="top">
                <MenuItem
                  sx={{ minWidth: 0 }}
                  onClick={() => {
                    (onQuerySelect ?? actions.onQuerySelect)?.(
                      menu.node,
                      query,
                    );
                    setMenu(null);
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ width: "100%", minWidth: 0 }}
                  >
                    <Chip
                      size="small"
                      label={query.count}
                      sx={{ flexShrink: 0 }}
                    />
                    <Box
                      component="span"
                      sx={{
                        minWidth: 0,
                        flex: "1 1 auto",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {query.query}
                    </Box>
                    {query.statuses
                      .filter(({ status }) => status)
                      .map(({ status, count }) => (
                        <Chip
                          key={status}
                          size="small"
                          color={severity(status)}
                          label={`${status}: ${count}`}
                          sx={{ flexShrink: 0 }}
                        />
                      ))}
                    <Tooltip
                      title={
                        copyStatus?.query === query.query
                          ? copyStatus.message
                          : "Copy query"
                      }
                    >
                      <IconButton
                        size="small"
                        aria-label={
                          copyStatus?.query === query.query
                            ? copyStatus.message
                            : "Copy query"
                        }
                        sx={{ flexShrink: 0 }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!navigator.clipboard?.writeText) {
                            setCopyStatus({
                              query: query.query,
                              message: "Copy unavailable",
                            });
                            return;
                          }
                          void navigator.clipboard.writeText(query.query).then(
                            () =>
                              setCopyStatus({
                                query: query.query,
                                message: "Copied",
                              }),
                            () =>
                              setCopyStatus({
                                query: query.query,
                                message: "Copy failed",
                              }),
                          );
                        }}
                      >
                        <SvgIcon fontSize="small">
                          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1 .9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                        </SvgIcon>
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </MenuItem>
              </Tooltip>
            ))}
      </Menu>
    </Box>
  );
}
