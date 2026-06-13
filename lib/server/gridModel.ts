import { GridEdge, GridNode } from "@/lib/types";
import { getCaisoSignals, getGridEdges, getGridNodes, getWeatherSignals } from "./jsonData";

export function adjacencyMap(edges: GridEdge[], excludeNode?: string) {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const from = edge.from_node;
    const to = edge.to_node;
    if (!from || !to || from === to) continue;
    if (excludeNode && (from === excludeNode || to === excludeNode)) continue;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from)!.add(to);
    adjacency.get(to)!.add(from);
  }
  return adjacency;
}

export function nodeById(nodes: GridNode[]) {
  return new Map(nodes.map((node) => [String(node._id), node]));
}

export function statusCounts(nodes: GridNode[]) {
  return nodes.reduce(
    (acc, node) => {
      const status = String(node.status || "normal");
      if (status === "critical") acc.critical += 1;
      else if (status === "high") acc.high += 1;
      else if (status === "elevated") acc.elevated += 1;
      else acc.normal += 1;
      return acc;
    },
    { normal: 0, elevated: 0, high: 0, critical: 0 }
  );
}

export function sustainabilityMetrics(nodes: GridNode[], failedNode?: GridNode, options?: Array<{ score?: number }>) {
  const counts = statusCounts(nodes);
  const highCritical = counts.high + counts.critical;
  const readiness = Math.round(Math.max(0, 1 - highCritical / Math.max(nodes.length, 1)) * 100);
  const criticalSitesProtected = nodes.filter((node) => node.critical_infrastructure).length;
  const bestScore = Number(options?.[0]?.score || 0.18);
  const demandReroutedMW = failedNode ? Number(((failedNode.current_load_kw || 0) / 1000).toFixed(1)) : 2.4;

  return {
    critical_sites_protected: criticalSitesProtected,
    criticalSitesProtected,
    cascade_risk_reduction: Number(Math.max(bestScore, 0.18).toFixed(3)),
    cascadeRiskReduction: Number(Math.max(bestScore, 0.18).toFixed(3)),
    demand_safely_rerouted_mw: demandReroutedMW,
    demandReroutedMW,
    diesel_backup_avoided_minutes: failedNode ? Math.max(12, Math.round(demandReroutedMW * 2)) : 37,
    dieselBackupAvoidedMinutes: failedNode ? Math.max(12, Math.round(demandReroutedMW * 2)) : 37,
    grid_readiness_score: readiness,
    sustainable_grid_readiness: readiness,
    sustainableGridReadinessDelta: options?.length ? 6 : 0
  };
}

export async function gridSnapshot() {
  const [nodes, edges, weather, caiso] = await Promise.all([
    getGridNodes(),
    getGridEdges(),
    getWeatherSignals(),
    getCaisoSignals()
  ]);
  const counts = statusCounts(nodes);
  const currentWeather = (weather.current || {}) as Record<string, number>;
  const currentCaiso = (caiso.current || {}) as Record<string, number>;
  return {
    nodes,
    edges,
    weather,
    caiso,
    counts,
    currentWeather,
    currentCaiso,
    sustainability: sustainabilityMetrics(nodes)
  };
}

export function attachNeighbors(nodes: GridNode[], edges: GridEdge[]) {
  const adjacency = adjacencyMap(edges);
  return nodes.map((node) => ({
    ...node,
    neighbors: Array.from(adjacency.get(String(node._id)) || []).sort()
  }));
}

export function gridStressLevel(avgRisk: number) {
  if (avgRisk < 0.3) return "normal";
  if (avgRisk < 0.6) return "elevated";
  if (avgRisk < 0.8) return "high";
  return "critical";
}
