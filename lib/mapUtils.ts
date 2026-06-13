import { Feature, FeatureCollection, Geometry, LineString, Point } from "geojson";
import { GridEdge, GridNode, GridStatus, RiskSummary } from "./types";

export const statusColors: Record<GridStatus, string> = {
  normal: "#22c55e",
  elevated: "#facc15",
  high: "#f97316",
  critical: "#ef4444"
};

export function normalizeStatus(status?: string): GridStatus {
  if (status === "critical" || status === "high" || status === "elevated" || status === "normal") return status;
  return "normal";
}

function coordinateValue(value: unknown) {
  const numberValue = typeof value === "string" ? Number(value) : value;
  return typeof numberValue === "number" && Number.isFinite(numberValue) ? numberValue : undefined;
}

export function getNodeCoordinates(node?: GridNode): [number, number] | undefined {
  const latitude = coordinateValue(node?.latitude);
  const longitude = coordinateValue(node?.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  if (latitude < 37.7 || latitude > 37.83 || longitude < -122.53 || longitude > -122.35) return undefined;
  return [longitude, latitude];
}

export function isValidCoordinate(node?: GridNode) {
  return Boolean(getNodeCoordinates(node));
}

export function pct(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function inferRiskFromNodes(nodes: GridNode[]): RiskSummary {
  const counts = nodes.reduce(
    (acc, node) => {
      acc[normalizeStatus(node.status)] += 1;
      return acc;
    },
    { normal: 0, elevated: 0, high: 0, critical: 0 }
  );
  const total = nodes.length || 1;
  const avgRisk = nodes.reduce((sum, node) => sum + pct(node.risk_score), 0) / total;
  const avgLoad = nodes.reduce((sum, node) => sum + pct(node.load_pct), 0) / total;
  const status = counts.critical ? "critical" : counts.high ? "high" : counts.elevated ? "elevated" : "normal";

  return {
    status,
    normal_count: counts.normal,
    elevated_count: counts.elevated,
    high_count: counts.high,
    critical_count: counts.critical,
    caiso_demand_stress: avgLoad,
    weather_risk_score: avgRisk * 0.75,
    overall_risk_score: avgRisk,
    total_substations: nodes.length
  };
}

export function nodeFeatureCollection(nodes: GridNode[], cascadeIds: string[] = [], selectedNodeId?: string): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: nodes.flatMap((node) => {
      const coordinates = getNodeCoordinates(node);
      if (!coordinates) return [];
      return [{
        type: "Feature",
        geometry: { type: "Point", coordinates },
        properties: {
          id: node._id,
          subname: node.subname || node._id,
          neighborhood: node.neighborhood || "Unknown",
          status: normalizeStatus(node.status),
          color: statusColors[normalizeStatus(node.status)],
          risk: pct(node.risk_score),
          load: pct(node.load_pct),
          critical: Boolean(node.critical_infrastructure),
          cascade: cascadeIds.includes(node._id),
          selected: selectedNodeId === node._id,
          label: node.neighborhood || node.subname || node._id
        }
      }];
    })
  };
}

export function edgeFeatureCollection(nodes: GridNode[], edges: GridEdge[]): FeatureCollection {
  const nodeById = new Map(nodes.map((node) => [node._id, node]));
  let renderable = 0;
  let dropped = 0;

  const features: Feature<Geometry>[] = edges.flatMap((edge) => {
    const load = pct(edge.current_load_pct);
    const props = { id: edge._id, load, color: load > 0.75 ? "#f97316" : load >= 0.45 ? "#fb923c" : "#facc15" };

    // Use embedded geometry when available (MultiLineString from backend GIS data)
    if (edge.geometry && (edge.geometry.type === "MultiLineString" || edge.geometry.type === "LineString")) {
      renderable++;
      return [{ type: "Feature" as const, geometry: edge.geometry as unknown as Geometry, properties: props }];
    }

    // Fall back to straight-line between node endpoints (string-compare IDs)
    const from = edge.from_node ? nodeById.get(String(edge.from_node)) : undefined;
    const to = edge.to_node ? nodeById.get(String(edge.to_node)) : undefined;
    const fromCoordinates = getNodeCoordinates(from);
    const toCoordinates = getNodeCoordinates(to);
    if (!fromCoordinates || !toCoordinates) {
      dropped++;
      return [];
    }
    renderable++;
    return [{
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: [fromCoordinates, toCoordinates] },
      properties: props
    }];
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`[SmartGrid] Edges: total=${edges.length} renderable=${renderable} dropped=${dropped}`);
  }
  return { type: "FeatureCollection", features };
}

export function pathFeatureCollection(nodes: GridNode[], path?: string[]): FeatureCollection<LineString> {
  const nodeById = new Map(nodes.map((node) => [node._id, node]));
  const coordinates = (path || []).map((id) => getNodeCoordinates(nodeById.get(id))).filter((coordinates): coordinates is [number, number] => Boolean(coordinates));
  return {
    type: "FeatureCollection",
    features: coordinates.length > 1 ? [{ type: "Feature", geometry: { type: "LineString", coordinates }, properties: {} }] : []
  };
}

export function getHighestRiskNode(nodes: GridNode[]) {
  return [...nodes].sort((a, b) => pct(b.risk_score) - pct(a.risk_score))[0];
}

// Converts the backend /api/risk/current response (which uses different field names)
// into the RiskSummary shape the frontend components expect.
export function normalizeRiskSummary(raw: RiskSummary, nodes: GridNode[]): RiskSummary {
  // Already in frontend format (has normal_count) — no conversion needed
  if (typeof raw.normal_count === "number") return raw;

  // Backend format: compute per-status counts from live node data, merge with backend scores
  const inferred = inferRiskFromNodes(nodes);
  return {
    ...inferred,
    status: normalizeStatus(String(raw.grid_stress_level || raw.status || inferred.status)),
    caiso_demand_stress: typeof raw.demand_stress_score === "number" ? raw.demand_stress_score : inferred.caiso_demand_stress,
    weather_risk_score: typeof raw.weather_risk_score === "number" ? raw.weather_risk_score : inferred.weather_risk_score,
    overall_risk_score: typeof raw.overall_risk_score === "number" ? raw.overall_risk_score : inferred.overall_risk_score,
    total_substations: typeof raw.total_nodes === "number" ? raw.total_nodes : inferred.total_substations
  };
}
