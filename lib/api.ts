import { AgentResponse, CascadeSimulation, GridEdge, GridNode, LiveSignals, RerouteSimulation, RiskSummary } from "./types";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers
      }
    });
  } catch (error) {
    throw new Error(`Unable to reach SmartGrid API ${path}: ${error instanceof Error ? error.message : "network error"}`);
  }

  if (!response.ok) {
    throw new Error(`SmartGrid API ${path} returned ${response.status}`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`SmartGrid API ${path} returned invalid JSON`);
  }
}

export const fetchGridNodes = () => requestJson<GridNode[]>("/api/grid/nodes");
export const fetchGridEdges = () => requestJson<GridEdge[]>("/api/grid/edges");
export const fetchRiskSummary = () => requestJson<RiskSummary>("/api/risk/current");
export const fetchLiveSignals = () => requestJson<LiveSignals>("/api/signals/live");

export function simulateCascade(failedNodeId: string) {
  return requestJson<CascadeSimulation>("/api/simulate/cascade", {
    method: "POST",
    body: JSON.stringify({ failed_node_id: failedNodeId })
  });
}

export function simulateReroute(failedNodeId: string) {
  return requestJson<RerouteSimulation>("/api/simulate/reroute", {
    method: "POST",
    body: JSON.stringify({ failed_node_id: failedNodeId })
  });
}

export function queryAgent(query: string, context: unknown) {
  return requestJson<AgentResponse>("/api/agent/query", {
    method: "POST",
    body: JSON.stringify({ message: query, query, context })
  });
}
