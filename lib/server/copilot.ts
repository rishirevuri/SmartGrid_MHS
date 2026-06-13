import { GridNode } from "@/lib/types";
import { askBackboard, rememberLocal } from "./backboard";
import { gridSnapshot, gridStressLevel } from "./gridModel";

function pct(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value || 0);
  return Math.round(Math.max(0, Math.min(1, numberValue)) * 100);
}

function selectedNodeName(node?: Partial<GridNode>) {
  if (!node) return "the selected grid area";
  return node.neighborhood || node.subname || (node._id ? `substation ${node._id}` : "the selected grid area");
}

function localFallback(query: string, selectedNode: Partial<GridNode> | undefined, snapshot: Awaited<ReturnType<typeof gridSnapshot>>, latestReroute: { reroute_options?: Array<{ path: string[]; score: number; explanation: string }> } | undefined) {
  const q = query.toLowerCase();
  const highest = [...snapshot.nodes].sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))[0];
  const bestRoute = latestReroute?.reroute_options?.[0];

  if (q.includes("highest risk")) {
    return `${highest.neighborhood || highest.subname || highest._id} is the highest-risk area right now at ${pct(highest.risk_score)}% risk. Stabilizing it improves sustainable city resilience by protecting electrified services and reducing emergency backup dependence.`;
  }
  if (q.includes("sustain") || q.includes("diesel") || q.includes("climate")) {
    return `Sustainability impact: SmartGrid is protecting ${snapshot.sustainability.critical_sites_protected} critical sites, keeping grid readiness at ${snapshot.sustainability.sustainable_grid_readiness}/100, and avoiding an estimated ${snapshot.sustainability.diesel_backup_avoided_minutes} minutes of emergency backup reliance by rerouting demand before a cascade spreads.`;
  }
  if (q.includes("reroute") || q.includes("route") || q.includes("green line")) {
    return bestRoute
      ? `The recommended reroute follows ${bestRoute.path.join(" -> ")}. It reduces cascade exposure by about ${Math.round(bestRoute.score * 100)}% while keeping demand on cleaner grid assets instead of forcing critical facilities onto backup generation.`
      : `No active reroute is selected yet. Simulate Grid Stress on a substation and I will explain the route, demand shifted, critical sites protected, and diesel backup avoided.`;
  }
  if (q.includes("critical") || q.includes("protect")) {
    return `SmartGrid is tracking ${snapshot.sustainability.critical_sites_protected} critical sites. The sustainability goal is to keep hospitals, emergency response, and dense city loads energized while preventing one stressed feeder from becoming a wider outage.`;
  }
  if (q.includes("fail") || q.includes("cascade")) {
    return `If ${selectedNodeName(selectedNode)} fails, SmartGrid checks connected feeders, estimates load transfer pressure, and recommends a lower-risk path. This reliability layer helps cities electrify buildings, transit, and charging without falling back to carbon-heavy emergency operations.`;
  }
  return `${selectedNodeName(selectedNode)} is being evaluated with local grid topology, demand stress, weather risk, and critical infrastructure flags. Current sustainable grid readiness is ${snapshot.sustainability.sustainable_grid_readiness}/100. Ask about reroutes, cascade risk, diesel backup avoided, or critical sites protected.`;
}

export async function answerCopilot(query: string, context: Record<string, unknown> = {}) {
  const snapshot = await gridSnapshot();
  const selectedNode = context.selectedNode as Partial<GridNode> | undefined;
  const latestReroute = context.latestReroute as { reroute_options?: Array<{ path: string[]; score: number; explanation: string }> } | undefined;
  const latestSimulation = context.latestSimulation;
  const threadId = typeof context.thread_id === "string" ? context.thread_id : undefined;
  const assistantId = typeof context.assistant_id === "string" ? context.assistant_id : undefined;
  const avgRisk = snapshot.nodes.reduce((sum, node) => sum + Number(node.risk_score || 0), 0) / Math.max(snapshot.nodes.length, 1);
  const highest = [...snapshot.nodes].sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))[0];

  const prompt = [
    "You are SmartGrid, a sustainable city grid operator copilot.",
    "Answer like a calm professional power-grid operator focused on climate resilience, critical infrastructure, cascade prevention, demand rerouting, and reducing diesel backup dependence.",
    "Do not mention retired implementation details or backend infrastructure.",
    "",
    `User question: ${query}`,
    "",
    "Current grid risk:",
    `- Total grid nodes: ${snapshot.nodes.length}`,
    `- Feeder edges: ${snapshot.edges.length}`,
    `- Grid stress level: ${gridStressLevel(avgRisk)}`,
    `- Highest-risk node: ${highest?.neighborhood || highest?.subname || highest?._id} (${pct(highest?.risk_score)}% risk, status ${highest?.status})`,
    `- Weather risk: ${snapshot.currentWeather.weather_risk_score ?? 0}`,
    `- Demand stress: ${snapshot.currentCaiso.system_stress_score ?? 0.5}`,
    "",
    "Sustainability impact metrics:",
    `- Critical sites protected: ${snapshot.sustainability.critical_sites_protected}`,
    `- Sustainable grid readiness: ${snapshot.sustainability.sustainable_grid_readiness}/100`,
    `- Cascade risk reduction: ${Math.round(Number(snapshot.sustainability.cascade_risk_reduction) * 100)}%`,
    `- Demand safely rerouted: ${snapshot.sustainability.demand_safely_rerouted_mw} MW`,
    `- Diesel backup avoided: ${snapshot.sustainability.diesel_backup_avoided_minutes} minutes`,
    "",
    selectedNode ? `Selected node: ${JSON.stringify(selectedNode)}` : "Selected node: none",
    latestSimulation ? `Cascade context: ${JSON.stringify(latestSimulation)}` : "Cascade context: none",
    latestReroute ? `Reroute context: ${JSON.stringify(latestReroute)}` : "Reroute context: none",
    context.decisionLog ? `Recent operator history: ${JSON.stringify(context.decisionLog)}` : "Recent operator history: none",
    "",
    "Give a concise, specific answer that connects the grid event to sustainable city resilience."
  ].join("\n");

  rememberLocal({
    type: "operator_question",
    question: query,
    payload: { selectedNode, latestSimulation, latestReroute, decisionLog: context.decisionLog }
  });

  try {
    const result = await askBackboard({
      prompt,
      message: query,
      threadId,
      assistantId,
      metadata: {
        app: "SmartGrid",
        nodes: snapshot.nodes.length,
        edges: snapshot.edges.length,
        sustainability: snapshot.sustainability
      }
    });

    return {
      response: result.response,
      model: "backboard",
      provider: "backboard",
      context_nodes: snapshot.nodes.length,
      thread_id: result.thread_id,
      assistant_id: result.assistant_id
    };
  } catch (error) {
    const backboardError = error instanceof Error ? error.message : String(error);
    return {
      response: localFallback(query, selectedNode, snapshot, latestReroute),
      model: "local-sustainability-fallback",
      provider: "local-fallback",
      context_nodes: snapshot.nodes.length,
      backboard_error: backboardError
    };
  }
}
