import { GridEdge, GridNode } from "@/lib/types";
import { adjacencyMap, nodeById, sustainabilityMetrics } from "./gridModel";

export function simulateCascade(nodes: GridNode[], edges: GridEdge[], failedNodeId: string) {
  const lookup = nodeById(nodes);
  const failedNode = lookup.get(failedNodeId);
  if (!failedNode) return null;

  const adjacency = adjacencyMap(edges);
  const loadCache = new Map(nodes.map((node) => [String(node._id), Number(node.current_load_kw || 0)]));
  const cascadePath = [failedNodeId];
  const failed = new Set([failedNodeId]);
  const queue = [failedNodeId];

  while (queue.length) {
    const current = queue.shift()!;
    const neighbors = Array.from(adjacency.get(current) || []).filter((id) => !failed.has(id));
    if (!neighbors.length) continue;

    const redistributed = Number(loadCache.get(current) || 0) / neighbors.length;
    for (const neighbor of neighbors) {
      const nextLoad = Number(loadCache.get(neighbor) || 0) + redistributed;
      loadCache.set(neighbor, nextLoad);
      if (nextLoad > 15000 && !failed.has(neighbor)) {
        failed.add(neighbor);
        cascadePath.push(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const criticalAtRisk = cascadePath
    .slice(1)
    .filter((id) => lookup.get(id)?.critical_infrastructure);

  return {
    failed_node_id: failedNodeId,
    cascade_path: cascadePath,
    affected_count: cascadePath.length,
    critical_infrastructure_at_risk: criticalAtRisk,
    sustainability: sustainabilityMetrics(nodes, failedNode)
  };
}

export function simulateReroute(nodes: GridNode[], edges: GridEdge[], failedNodeId: string) {
  const lookup = nodeById(nodes);
  const failedNode = lookup.get(failedNodeId);
  if (!failedNode) return null;

  const originalAdjacency = adjacencyMap(edges);
  const adjacency = adjacencyMap(edges, failedNodeId);
  const directNeighbors = Array.from(originalAdjacency.get(failedNodeId) || []);
  const failedLoad = Number(failedNode.current_load_kw || 0);
  const options: Array<{ path: string[]; score: number; explanation: string }> = [];
  const seen = new Set<string>();

  function scorePath(path: string[]) {
    const intermediate = path.slice(1, -1);
    if (!intermediate.length) return { score: 0, explanation: "direct single-hop path" };

    const avgRisk = intermediate.reduce((sum, id) => sum + Number(lookup.get(id)?.risk_score || 0.5), 0) / intermediate.length;
    const minLoad = Math.min(...intermediate.map((id) => Number(lookup.get(id)?.current_load_kw || 0)));
    const spareRatio = Math.max(0, (15000 - minLoad - failedLoad) / 15000);
    const protectsCritical = intermediate.some((id) => lookup.get(id)?.critical_infrastructure);
    const score = Number((0.5 * spareRatio + 0.4 * (1 - avgRisk) + (protectsCritical ? 0.1 : 0)).toFixed(4));
    return {
      score,
      explanation: `Path through ${intermediate.length} intermediate node(s); avg risk ${avgRisk.toFixed(2)}; spare capacity ratio ${spareRatio.toFixed(2)}${protectsCritical ? " - protects critical infrastructure" : ""}`
    };
  }

  for (const start of directNeighbors) {
    const directKey = [failedNodeId, start].join(">");
    if (!seen.has(directKey)) {
      seen.add(directKey);
      const scored = scorePath([failedNodeId, start]);
      options.push({ path: [failedNodeId, start], ...scored });
    }

    for (const next of Array.from(adjacency.get(start) || [])) {
      const path = [failedNodeId, start, next];
      const key = path.join(">");
      if (next === failedNodeId || seen.has(key)) continue;
      seen.add(key);
      options.push({ path, ...scorePath(path) });
    }
  }

  options.sort((a, b) => b.score - a.score);
  const topOptions = options.slice(0, 3);
  return {
    failed_node_id: failedNodeId,
    reroute_options: topOptions,
    sustainability: sustainabilityMetrics(nodes, failedNode, topOptions)
  };
}
