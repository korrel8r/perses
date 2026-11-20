import type { IconDefinition } from "@fortawesome/fontawesome-common-types";
import {
  faChartGantt,
  faChartLine,
  faCircle,
  faCircleDot,
  faClockRotateLeft,
  faClone,
  faCube,
  faFileLines,
  faFileShield,
  faFolder,
  faHexagonNodes,
  faListCheck,
  faNetworkWired,
  faServer,
  faShuffle,
  faSliders,
} from "@fortawesome/free-solid-svg-icons";
import { AttentionBellIconConfig } from "@patternfly/react-icons/dist/js/icons/attention-bell-icon";
import { ClusterIconConfig } from "@patternfly/react-icons/dist/js/icons/cluster-icon";
import { OutlinedHddIconConfig } from "@patternfly/react-icons/dist/js/icons/outlined-hdd-icon";
import { ServiceIconConfig } from "@patternfly/react-icons/dist/js/icons/service-icon";
import { KubernetesIconConfig } from "./KubernetesIcon";

// ECharts needs SVG image symbols rather than React elements. The source
// matches the console plugin's Font Awesome / PatternFly icon choices.
function fa(icon: IconDefinition): string {
  const [width, height, , , paths] = icon.icon;
  const data = Array.isArray(paths) ? paths : [paths];
  return `<svg width="25" height="25" viewBox="0 0 ${width} ${height}">${data.map((path) => `<path fill="currentColor" d="${path}"/>`).join("")}</svg>`;
}

function pf(icon: {
  icon: { width: number; height: number; svgPathData: string };
}): string {
  const { width, height, svgPathData } = icon.icon;
  return `<svg width="25" height="25" viewBox="0 0 ${width} ${height}"><path fill="currentColor" d="${svgPathData}"/></svg>`;
}

function kubernetes(): string {
  const { width, height, svgPath } = KubernetesIconConfig;
  return `<svg width="25" height="25" viewBox="0 0 ${width} ${height}"><path fill="currentColor" d="${svgPath}"/></svg>`;
}

const domainIcons: Record<string, string> = {
  alert: pf(AttentionBellIconConfig),
  k8s: kubernetes(),
  log: fa(faFileLines),
  metric: fa(faChartLine),
  netflow: fa(faNetworkWired),
  trace: fa(faChartGantt),
};

const classIcons: Record<string, string> = {
  "k8s:ConfigMap.v1": fa(faSliders),
  "k8s:CronJob.v1": fa(faClockRotateLeft),
  "k8s:Deployment.v1.apps": fa(faServer),
  "k8s:DaemonSet.v1": fa(faServer),
  "k8s:StatefulSet.v1": fa(faServer),
  "k8s:Endpoints.v1": fa(faHexagonNodes),
  "k8s:EndpointSlice.v1.discovery.k8s.io": fa(faHexagonNodes),
  "k8s:Event.v1": fa(faListCheck),
  "k8s:Event.v1.events.k8s.io": fa(faListCheck),
  "k8s:Namespace.v1": fa(faFolder),
  "k8s:Node.v1": pf(OutlinedHddIconConfig),
  "k8s:Secret.v1": fa(faFileShield),
  "k8s:ReplicaSet.v1.apps": fa(faClone),
  "k8s:PersistentVolume.v1": fa(faCircleDot),
  "k8s:PersistentVolumeClaim.v1": fa(faCircle),
  "k8s:Pod.v1": fa(faCube),
  "k8s:Route.v1.route.openshift.io": fa(faShuffle),
  "k8s:Gateway.v1.gateway.networking.k8s.io": fa(faShuffle),
  "k8s:Ingress.v1.networking.k8s.io": fa(faShuffle),
  "k8s:Service.v1": pf(ServiceIconConfig),
};

const fallbackIcon = pf(ClusterIconConfig);

/** Inner SVG markup for the exact class, its domain, or the generic cluster. */
export function nodeIcon(id: string): string {
  return classIcons[id] ?? domainIcons[id.split(":")[0]!] ?? fallbackIcon;
}
