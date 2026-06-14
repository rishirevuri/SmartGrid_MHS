"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GridMap from "@/components/GridMap";
import CommandPanel from "@/components/CommandPanel";
import { fetchGridEdges, fetchGridNodes, fetchLiveSignals, fetchRiskSummary, simulateCascade, simulateReroute } from "@/lib/api";
import { fallbackEdges, fallbackLiveSignals, fallbackNodes, fallbackRiskSummary } from "@/lib/fallbacks";
import { getHighestRiskNode, getNodeCoordinates, inferRiskFromNodes, normalizeRiskSummary, pct } from "@/lib/mapUtils";
import { CascadeSimulation, DecisionLogEntry, GridEdge, GridNode, LiveSignals, RerouteSimulation, RiskSummary } from "@/lib/types";

const initialLog: DecisionLogEntry[] = [
  { id: "init-1", timestamp: new Date().toISOString(), type: "INFO", explanation: "SmartGrid initialized San Francisco grid digital twin." },
  { id: "init-2", timestamp: new Date().toISOString(), type: "INFO", explanation: "Live monitoring active for substations, feeder load, CAISO demand, and weather stress." }
];

function listFromUnknown(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function findClosestNodeIds(target: GridNode, allNodes: GridNode[], count: number): string[] {
  const origin = getNodeCoordinates(target);
  if (!origin) return allNodes.filter(n => n._id !== target._id).slice(0, count).map(n => n._id);
  return allNodes
    .filter(n => n._id !== target._id && getNodeCoordinates(n))
    .sort((a, b) => {
      const ac = getNodeCoordinates(a)!;
      const bc = getNodeCoordinates(b)!;
      return ((ac[0] - origin[0]) ** 2 + (ac[1] - origin[1]) ** 2)
           - ((bc[0] - origin[0]) ** 2 + (bc[1] - origin[1]) ** 2);
    })
    .slice(0, count)
    .map(n => n._id);
}

export default function Page() {
  const [nodes, setNodes] = useState<GridNode[]>(fallbackNodes);
  const [edges, setEdges] = useState<GridEdge[]>(fallbackEdges);
  const [riskSummary, setRiskSummary] = useState<RiskSummary>(fallbackRiskSummary);
  const [liveSignals, setLiveSignals] = useState<LiveSignals>(fallbackLiveSignals);
  const [selectedNode, setSelectedNode] = useState<GridNode | undefined>(getHighestRiskNode(fallbackNodes));
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>(initialLog);
  const [cascadeNodeIds, setCascadeNodeIds] = useState<string[]>([]);
  const [reroutePath, setReroutePath] = useState<string[]>([]);
  const [dangerPath, setDangerPath] = useState<string[]>([]);
  const [latestSimulation, setLatestSimulation] = useState<CascadeSimulation | undefined>();
  const [latestReroute, setLatestReroute] = useState<RerouteSimulation | undefined>();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanVersion, setScanVersion] = useState(0);

  // Ref keeps nodes current inside refreshLiveContext without adding it to deps,
  // which previously caused an infinite load→setNodes→recreate→load loop.
  const nodesRef = useRef<GridNode[]>(fallbackNodes);
  const edgesRef = useRef<GridEdge[]>(fallbackEdges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const refreshLiveContext = useCallback(async () => {
    setIsScanning(true);
    try {
      const [apiNodes, apiEdges, risk, signals] = await Promise.all([
        fetchGridNodes(),
        fetchGridEdges(),
        fetchRiskSummary(),
        fetchLiveSignals()
      ]);
      const safeNodes = Array.isArray(apiNodes) && apiNodes.length ? apiNodes : nodesRef.current;
      const safeEdges = Array.isArray(apiEdges) && apiEdges.length ? apiEdges : edgesRef.current;
      setNodes(safeNodes);
      setEdges(safeEdges);
      setRiskSummary(normalizeRiskSummary(risk, safeNodes));
      setLiveSignals(signals);
      setLastUpdated(new Date());
      setScanVersion((current) => current + 1);
      setDemoMode(false);
    } catch (error) {
      console.warn("[SmartGrid] Risk/signals refresh failed:", error instanceof Error ? error.message : error);
      setDemoMode(true);
      setRiskSummary((current) => current || inferRiskFromNodes(nodesRef.current));
      setLiveSignals((current) => current || fallbackLiveSignals);
    } finally {
      window.setTimeout(() => setIsScanning(false), 450);
    }
  }, []); // stable polling; live node/edge snapshots are read from refs

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [apiNodes, apiEdges, risk, signals] = await Promise.all([fetchGridNodes(), fetchGridEdges(), fetchRiskSummary(), fetchLiveSignals()]);
        if (!active) return;
        const safeNodes = Array.isArray(apiNodes) && apiNodes.length ? apiNodes : fallbackNodes;
        const safeEdges = Array.isArray(apiEdges) && apiEdges.length ? apiEdges : fallbackEdges;
        console.log(`[SmartGrid] Nodes: ${safeNodes.length} returned (api=${Array.isArray(apiNodes) ? apiNodes.length : 0})`);
        console.log(`[SmartGrid] Edges: ${safeEdges.length} returned (api=${Array.isArray(apiEdges) ? apiEdges.length : 0})`);
        const renderableCount = safeEdges.filter(e => e.geometry || (e.from_node && e.to_node && e.from_node !== e.to_node)).length;
        console.log(`[SmartGrid] Renderable edges: ${renderableCount} dropped: ${safeEdges.length - renderableCount}`);
        console.log("[SmartGrid] Risk endpoint: success");
        console.log("[SmartGrid] Signals endpoint: success");
        setNodes(safeNodes);
        setEdges(safeEdges);
        setRiskSummary(normalizeRiskSummary(risk, safeNodes));
        setLiveSignals(signals || fallbackLiveSignals);
        setSelectedNode(getHighestRiskNode(safeNodes));
        setScanVersion((current) => current + 1);
        setDemoMode(false);
      } catch (error) {
        if (!active) return;
        console.warn("[SmartGrid] Initial load failed, using demo fallback:", error instanceof Error ? error.message : error);
        setNodes(fallbackNodes);
        setEdges(fallbackEdges);
        setRiskSummary(fallbackRiskSummary);
        setLiveSignals(fallbackLiveSignals);
        setSelectedNode(getHighestRiskNode(fallbackNodes));
        setDemoMode(true);
      } finally {
        if (active) {
          setLastUpdated(new Date());
          setLoading(false);
        }
      }
    }
    load();
    const interval = window.setInterval(refreshLiveContext, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshLiveContext]);

  const addLog = (entries: Omit<DecisionLogEntry, "id" | "timestamp">[]) => {
    setDecisionLog((current) => [
      ...entries.map((entry) => ({ ...entry, id: `${entry.type}-${Date.now()}-${Math.random()}`, timestamp: new Date().toISOString() })),
      ...current
    ]);
  };

  const animateCascade = async (ids: string[]) => {
    setCascadeNodeIds([]);
    for (const id of ids) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      setCascadeNodeIds((current) => Array.from(new Set([...current, id])));
    }
  };

  const runSimulation = useCallback(async (node: GridNode) => {
    setSelectedNode(node);
    setReroutePath([]);
    setDangerPath([]);
    let cascade: CascadeSimulation = {};
    let reroute: RerouteSimulation = {};

    try {
      cascade = await simulateCascade(node._id);
      setDemoMode(false);
    } catch {
      setDemoMode(true);
      cascade = { failed_node_id: node._id, affected_nodes: [node._id, ...(node.neighbors || []).slice(0, 3)], cascade_path: [node._id, ...(node.neighbors || []).slice(0, 3)], explanation: "Local simulation isolated overloaded adjacent feeders using fallback topology." };
    }

    const affected = listFromUnknown(cascade.affected_nodes).length ? listFromUnknown(cascade.affected_nodes) : listFromUnknown(cascade.cascade_path);
    setLatestSimulation(cascade);
    await animateCascade(affected.length ? affected : [node._id]);

    try {
      reroute = await simulateReroute(node._id);
      setDemoMode(false);
    } catch {
      setDemoMode(true);
      const fallbackPath = [node._id, ...(node.neighbors || []), "704", "309"].filter(Boolean).slice(0, 4);
      reroute = { failed_node_id: node._id, recommended_path: fallbackPath, rejected_path: [node._id, "221", "371"], explanation: "Fallback reroute favors lower-load feeders and avoids critical downtown congestion.", rejected_reason: "Rejected path crosses high-risk SoMa and Downtown feeders." };
    }

    // Backend returns reroute_options:[{path,score,explanation}]; fall back to legacy fields for demo mode
    const options: Array<{ path: string[]; score: number; explanation: string }> = Array.isArray(reroute.reroute_options)
      ? [...reroute.reroute_options]
      : [];
    // Synthesize routing if backend returned no valid paths (isolated node or no edge adjacency)
    if (options.length === 0) {
      const neighborIds = (node.neighbors || []).filter(id => id !== node._id).slice(0, 2);
      const candidates = neighborIds.length >= 1
        ? neighborIds
        : findClosestNodeIds(node, nodesRef.current, 2);
      if (candidates[0]) options.push({ path: [node._id, candidates[0]], score: 0.62, explanation: `Emergency reroute via feeder ${candidates[0]} — load shifted to nearest available capacity reserve.` });
      if (candidates[1]) options.push({ path: [node._id, candidates[1]], score: 0.41, explanation: `Secondary emergency path via ${candidates[1]} — backup capacity reserve.` });
    }
    const recommended = options[0]?.path?.length
      ? options[0].path
      : listFromUnknown(reroute.recommended_path).length
        ? listFromUnknown(reroute.recommended_path)
        : listFromUnknown(reroute.reroute_path);
    const rejected = options[1]?.path?.length
      ? options[1].path
      : listFromUnknown(reroute.rejected_path).length
        ? listFromUnknown(reroute.rejected_path)
        : listFromUnknown(reroute.alternative_path);
    const rerouteExplanation = options[0]?.explanation || String(reroute.explanation || `selected path reduces exposure from ${Math.round(pct(node.load_pct) * 100)}% load and ${Math.round(pct(node.risk_score) * 100)}% node risk.`);
    const rejectedExplanation = options[1]?.explanation || String(reroute.rejected_reason || "path would push load toward elevated or critical infrastructure feeders.");
    // Store enriched reroute so the chatbot can always read reroute_options (including synthesized ones)
    setLatestReroute({ ...reroute, reroute_options: options });
    setReroutePath(recommended);
    setDangerPath(rejected);

    addLog([
      { type: "FAULT", explanation: `Cascade failure detected at ${node.neighborhood || node.subname || node._id}. ${affected.length || 1} nodes affected.`, affectedNodes: affected },
      { type: "ACTION", explanation: `Rerouting through ${recommended.join(" → ") || "available feeder reserve"}. Reason: ${rerouteExplanation}`, path: recommended },
      { type: "REJECTED", explanation: `Rejected ${rejected.join(" → ") || "high-risk alternative path"}. Reason: ${rejectedExplanation}`, path: rejected }
    ]);
  }, []);

  return (
    <main className="app-texture min-h-screen overflow-hidden text-zinc-100">
      <div className="relative min-h-screen">
        <section className="absolute inset-0">
          <GridMap nodes={nodes} edges={edges} selectedNode={selectedNode} cascadeNodeIds={cascadeNodeIds} reroutePath={reroutePath} dangerPath={dangerPath} onSelectNode={setSelectedNode} onSimulate={runSimulation} demoMode={demoMode} />
        </section>
        <section className="pointer-events-none absolute inset-0 z-30">
          <CommandPanel nodes={nodes} edges={edges} riskSummary={riskSummary} liveSignals={liveSignals} decisionLog={decisionLog} selectedNode={selectedNode} latestSimulation={latestSimulation} latestReroute={latestReroute} lastUpdated={lastUpdated} loading={loading} demoMode={demoMode} isScanning={isScanning} scanVersion={scanVersion} />
        </section>
      </div>
    </main>
  );
}
