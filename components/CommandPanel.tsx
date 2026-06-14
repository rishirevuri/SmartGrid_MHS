"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RadioTower } from "lucide-react";
import { CascadeSimulation, DecisionLogEntry, GridEdge, GridNode, LiveSignals, RerouteSimulation, RiskSummary } from "@/lib/types";
import { pct } from "@/lib/mapUtils";
import StatusBadge from "./StatusBadge";
import GridStatus from "./GridStatus";
import GridCopilot from "./GridCopilot";

const DEFAULT_W = 496; // ~31rem
const MIN_W = 300;

// Reads a value from a nested path (e.g. "weather.avg_temp") or flat key.
// Mirrors the lookup used by the Live Signals panel so the compact top-left
// readout shows the same source values.
function readSignal(signals: LiveSignals | undefined, ...paths: string[]): string {
  if (!signals || Array.isArray(signals)) return "--";
  for (const path of paths) {
    let current: unknown = signals;
    let ok = true;
    for (const part of path.split(".")) {
      if (typeof current !== "object" || current === null) { ok = false; break; }
      current = (current as Record<string, unknown>)[part];
    }
    if (ok && current !== undefined && current !== null) return String(current);
  }
  return "--";
}

function CompactLiveSignals({ liveSignals }: { liveSignals?: LiveSignals }) {
  const temp = readSignal(liveSignals, "weather.avg_temp", "temperature_f");
  const wind = readSignal(liveSignals, "weather.avg_wind", "wind_speed_mph");
  const caiso = readSignal(liveSignals, "caiso.np15_current_mw", "caiso_demand_mw");
  const deviation = readSignal(liveSignals, "caiso.forecast_deviation_pct", "forecast_deviation_pct");
  const items: Array<[string, string]> = [
    ["Temp", `${temp}°F`],
    ["Wind", `${wind} mph`],
    ["CAISO", `${caiso} MW`],
    ["Forecast Δ", `${deviation}%`]
  ];
  return (
    <div className="mt-3 flex items-stretch justify-between gap-2 border-t border-white/[0.08] pt-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[9px] uppercase tracking-[0.08em] text-zinc-500">{label}</span>
          <span className="data-mono mt-0.5 truncate text-[13px] font-medium text-zinc-100">{value}</span>
        </div>
      ))}
    </div>
  );
}

function SelectedSubstation({ node }: { node?: GridNode }) {
  if (!node) return null;

  return (
    <section className="overlay-panel pointer-events-auto rounded-xl p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="panel-title">Power Substation</div>
          <h2 className="mt-2 text-base font-medium tracking-tight text-zinc-100">{node.subname || node._id}</h2>
          <p className="mt-0.5 text-xs text-zinc-300">{node.neighborhood || "Unknown sector"}</p>
        </div>
        <StatusBadge status={node.status} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-3">
          <div className="text-[11px] text-zinc-300">Line load</div>
          <div className="data-mono mt-1 text-xl font-medium text-white">{Math.round(pct(node.load_pct) * 100)}%</div>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-3">
          <div className="text-[11px] text-zinc-300">Risk score</div>
          <div className="data-mono mt-1 text-xl font-medium text-white">{Math.round(pct(node.risk_score) * 100)}%</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-xs">
        <span className="text-zinc-300">Critical infrastructure</span>
        <span className={node.critical_infrastructure ? "text-teal-300" : "text-zinc-200"}>{node.critical_infrastructure ? "Protected" : "Standard"}</span>
      </div>
    </section>
  );
}

function SustainabilityImpact({
  riskSummary,
  nodes,
  latestSimulation,
  latestReroute
}: {
  riskSummary?: RiskSummary;
  nodes: GridNode[];
  latestSimulation?: CascadeSimulation;
  latestReroute?: RerouteSimulation;
}) {
  const totalNodes = nodes.length || Number(riskSummary?.total_nodes || riskSummary?.total_substations || 29);
  const totalCritical = nodes.filter((n) => n.critical_infrastructure).length || Number(riskSummary?.critical_sites_protected || 4);

  // Cascade results — server returns cascade_path/affected_count; demo fallback uses affected_nodes.
  const cascadePath = (Array.isArray(latestSimulation?.cascade_path) && latestSimulation!.cascade_path!.length
    ? latestSimulation!.cascade_path!
    : Array.isArray(latestSimulation?.affected_nodes)
      ? latestSimulation!.affected_nodes!
      : []).map(String);
  const hasCascade = cascadePath.length > 0;
  const affectedCount = Number(
    (latestSimulation?.affected_count as number | undefined) ?? cascadePath.length
  );

  // Reroute results — top option score drives diesel + readiness deltas.
  const rerouteScore = Number(latestReroute?.reroute_options?.[0]?.score ?? 0);
  const hasReroute = Boolean(latestReroute?.reroute_options?.length);
  const sustainabilityDiesel = Number(
    (latestReroute as { sustainability?: { diesel_backup_avoided_minutes?: number } } | undefined)
      ?.sustainability?.diesel_backup_avoided_minutes ?? 0
  );

  const baseReadiness = Number(riskSummary?.sustainable_grid_readiness || riskSummary?.grid_readiness_score || 82);

  // CRITICAL SITES PROTECTED — critical-infra nodes that survived the cascade.
  const protectedSites = hasCascade
    ? nodes.filter((n) => n.critical_infrastructure && !cascadePath.includes(String(n._id))).length
    : totalCritical;

  // CASCADE RISK REDUCED — share of the grid that stayed up.
  const cascadeReduction = hasCascade
    ? Math.round(((totalNodes - affectedCount) / totalNodes) * 100)
    : 0;

  // DIESEL BACKUP AVOIDED — reroute_score * 60 proxy, with server sustainability as fallback.
  const dieselMinutes = hasReroute ? (Math.round(rerouteScore * 60) || sustainabilityDiesel) : 0;

  // GRID READINESS — recomputed once a simulation has run, capped 0–100.
  const readiness = (hasCascade || hasReroute)
    ? Math.max(0, Math.min(100, Math.round(baseReadiness - affectedCount * 2 + rerouteScore * 10)))
    : Math.round(baseReadiness);

  return (
    <section className="overlay-panel pointer-events-auto rounded-xl p-5">
      <div className="text-[15px] font-bold uppercase tracking-[0.12em] text-white" style={{ textShadow: "0 0 18px rgba(255,255,255,0.18)" }}>
        Sustainability Impact
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4">
          <div className="data-mono text-[34px] font-bold leading-none text-emerald-200">{protectedSites}</div>
          <div className="mt-2 text-xs font-medium text-zinc-200">Critical Sites Protected</div>
        </div>
        <div className="rounded-xl border border-sky-300/20 bg-sky-300/[0.07] p-4">
          <div className="data-mono text-[34px] font-bold leading-none text-sky-200">{readiness}<span className="text-lg text-sky-200/70">/100</span></div>
          <div className="mt-2 text-xs font-medium text-zinc-200">Grid Readiness</div>
        </div>
        <div className="rounded-xl border border-teal-300/20 bg-teal-300/[0.07] p-4">
          <div className="data-mono text-[34px] font-bold leading-none text-teal-200">{cascadeReduction}%</div>
          <div className="mt-2 text-xs font-medium text-zinc-200">Cascade Risk Reduced</div>
        </div>
        <div className="rounded-xl border border-yellow-300/20 bg-yellow-300/[0.07] p-4">
          <div className="data-mono text-[34px] font-bold leading-none text-yellow-100">{dieselMinutes}<span className="text-lg text-yellow-100/70"> min</span></div>
          <div className="mt-2 text-xs font-medium text-zinc-200">Diesel Backup Avoided</div>
        </div>
      </div>
    </section>
  );
}

export default function CommandPanel({
  nodes,
  edges,
  riskSummary,
  liveSignals,
  decisionLog,
  selectedNode,
  latestSimulation,
  latestReroute,
  lastUpdated,
  loading,
  demoMode,
  isScanning,
  scanVersion
}: {
  nodes: GridNode[];
  edges: GridEdge[];
  riskSummary?: RiskSummary;
  liveSignals?: LiveSignals;
  decisionLog: DecisionLogEntry[];
  selectedNode?: GridNode;
  latestSimulation?: unknown;
  latestReroute?: RerouteSimulation;
  lastUpdated?: Date;
  loading?: boolean;
  demoMode: boolean;
  isScanning?: boolean;
  scanVersion?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_W);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(DEFAULT_W);

  // Mouse drag handlers for resize
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const maxW = Math.floor(window.innerWidth * 0.5);
      const delta = dragStartX.current - e.clientX; // drag left → wider
      setPanelWidth(Math.max(MIN_W, Math.min(maxW, dragStartW.current + delta)));
    }
    function onUp() { isDragging.current = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function handleDragStart(e: React.MouseEvent) {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = panelWidth;
    e.preventDefault();
  }

  // Content scale: 1.0 at default width → up to 1.22 at 50vw
  const maxW = typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.5) : 800;
  const scaleT = Math.max(0, (panelWidth - DEFAULT_W) / Math.max(1, maxW - DEFAULT_W));
  const contentScale = 1 + scaleT * 0.22;

  const panelStyle = { width: panelWidth } as React.CSSProperties;
  const scaleStyle: React.CSSProperties = contentScale > 1.005
    ? { transform: `scale(${contentScale.toFixed(3)})`, transformOrigin: "top right" }
    : {};
  const slideClass = collapsed ? "translate-x-[calc(100%+2rem)] opacity-0" : "translate-x-0 opacity-100";

  return (
    <div className="h-full w-full">
      {/* Left status card */}
      <section className="overlay-panel pointer-events-auto absolute left-6 top-36 hidden w-[21rem] rounded-xl p-4 lg:block">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-[-0.04em] text-zinc-50">SmartGrid</h1>
            <p className="mt-1 text-sm text-zinc-200">SF Power Grid</p>
            <div className="panel-title mt-4">AI Infrastructure Command Center</div>
          </div>
          <StatusBadge status={riskSummary?.status} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs text-zinc-500">
          <span className="flex items-center gap-2"><RadioTower className="h-3.5 w-3.5 text-teal-300" /> Updated</span>
          <span className="data-mono text-zinc-300">{lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}</span>
        </div>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex items-center justify-between text-zinc-500">
            <span>Substations</span>
            <span className="data-mono text-zinc-300">{nodes.length}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-500">
            <span>Feeder edges</span>
            <span className="data-mono text-zinc-300">{edges.length}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-500">
            <span>Renderable feeders</span>
            <span className="data-mono text-zinc-300">{edges.filter(e => e.geometry || (e.from_node && e.to_node && e.from_node !== e.to_node)).length}</span>
          </div>
        </div>
        {demoMode
          ? <div className="mt-3 rounded-lg border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-xs text-yellow-200">Demo fallback mode</div>
          : <div className="mt-3 rounded-lg border border-teal-300/20 bg-teal-300/10 px-3 py-2 text-xs text-teal-200">Vercel API connected</div>}
        <CompactLiveSignals liveSignals={liveSignals} />
      </section>

      {/* Collapse / expand toggle button */}
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="overlay-panel pointer-events-auto absolute right-5 top-5 z-50 flex h-10 items-center gap-2 rounded-full px-3 text-xs font-medium text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.08]"
        aria-label={collapsed ? "Reveal command panels" : "Collapse command panels"}
      >
        {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {collapsed ? "Panels" : "Hide"}
      </button>

      {/* Right panels — draggable width */}
      <div
        className={`pointer-events-auto absolute right-5 top-16 transition-[transform,opacity] duration-500 ease-out ${slideClass}`}
        style={panelStyle}
      >
        {/* Drag handle on the left edge */}
        <div
          className="pointer-events-auto absolute -left-2 top-0 z-20 flex h-full w-4 cursor-ew-resize select-none items-start justify-center pt-6"
          onMouseDown={handleDragStart}
        >
          <div className="h-16 w-0.5 rounded-full bg-white/20 transition-colors hover:bg-white/55" />
        </div>

        {/* Content with proportional scale when panel is wider than default */}
        <div className="grid grid-cols-2 gap-3" style={scaleStyle}>
          <div className="col-span-2">
            <GridCopilot nodes={nodes} selectedNode={selectedNode} riskSummary={riskSummary} liveSignals={liveSignals} latestReroute={latestReroute} />
          </div>
          <div className="col-span-2">
            <SustainabilityImpact riskSummary={riskSummary} nodes={nodes} latestSimulation={latestSimulation as CascadeSimulation | undefined} latestReroute={latestReroute} />
          </div>
          <div className="col-span-2 md:col-span-1">
            <SelectedSubstation node={selectedNode} />
          </div>
          <div className="col-span-2 md:col-span-1">
            <GridStatus riskSummary={riskSummary} nodes={nodes} loading={loading} isScanning={isScanning} scanVersion={scanVersion} />
          </div>
        </div>
      </div>

    </div>
  );
}
