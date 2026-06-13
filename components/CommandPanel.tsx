"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RadioTower } from "lucide-react";
import { DecisionLogEntry, GridEdge, GridNode, LiveSignals, RerouteSimulation, RiskSummary } from "@/lib/types";
import { pct } from "@/lib/mapUtils";
import StatusBadge from "./StatusBadge";
import GridStatus from "./GridStatus";
import LiveSignalsPanel from "./LiveSignals";
import GridCopilot from "./GridCopilot";

const DEFAULT_W = 496; // ~31rem
const MIN_W = 300;

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

function SustainabilityImpact({ riskSummary }: { riskSummary?: RiskSummary }) {
  const readiness = Number(riskSummary?.sustainable_grid_readiness || riskSummary?.grid_readiness_score || 82);
  const cascadeReduction = Math.round(Number(riskSummary?.cascade_risk_reduction || 0.18) * 100);
  const protectedSites = Number(riskSummary?.critical_sites_protected || 4);
  const dieselMinutes = Number(riskSummary?.diesel_backup_avoided_minutes || 37);

  return (
    <section className="overlay-panel pointer-events-auto rounded-xl p-4">
      <div className="panel-title">Sustainability Impact</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] p-3">
          <div className="text-[11px] text-zinc-300">Critical Sites Protected</div>
          <div className="data-mono mt-1 text-lg font-medium text-emerald-200">{protectedSites}</div>
        </div>
        <div className="rounded-lg border border-sky-300/15 bg-sky-300/[0.06] p-3">
          <div className="text-[11px] text-zinc-300">Grid Readiness</div>
          <div className="data-mono mt-1 text-lg font-medium text-sky-200">{readiness}/100</div>
        </div>
        <div className="rounded-lg border border-teal-300/15 bg-teal-300/[0.06] p-3">
          <div className="text-[11px] text-zinc-300">Cascade Risk Reduced</div>
          <div className="data-mono mt-1 text-lg font-medium text-teal-200">{cascadeReduction}%</div>
        </div>
        <div className="rounded-lg border border-yellow-300/15 bg-yellow-300/[0.06] p-3">
          <div className="text-[11px] text-zinc-300">Diesel Backup Avoided</div>
          <div className="data-mono mt-1 text-lg font-medium text-yellow-100">{dieselMinutes} min</div>
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
          <div className="col-span-2 md:col-span-1">
            <SelectedSubstation node={selectedNode} />
          </div>
          <div className="col-span-2 md:col-span-1">
            <GridStatus riskSummary={riskSummary} nodes={nodes} loading={loading} isScanning={isScanning} scanVersion={scanVersion} />
          </div>
          <div className="col-span-2">
            <SustainabilityImpact riskSummary={riskSummary} />
          </div>
          <div className="col-span-2">
            <LiveSignalsPanel liveSignals={liveSignals} loading={loading} isScanning={isScanning} scanVersion={scanVersion} />
          </div>
        </div>
      </div>

    </div>
  );
}
