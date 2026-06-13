import { Activity, CloudSun, Gauge } from "lucide-react";
import { GridNode, RiskSummary } from "@/lib/types";
import { inferRiskFromNodes, pct } from "@/lib/mapUtils";
import AnimatedNumber from "./AnimatedNumber";
import MetricCard from "./MetricCard";

export default function GridStatus({
  riskSummary,
  nodes,
  loading,
  isScanning
}: {
  riskSummary?: RiskSummary;
  nodes: GridNode[];
  loading?: boolean;
  isScanning?: boolean;
  scanVersion?: number;
}) {
  const summary = riskSummary || inferRiskFromNodes(nodes);
  const boxes = [
    ["Normal", summary.normal_count ?? 0, "bg-emerald-400"],
    ["Elevated", summary.elevated_count ?? 0, "bg-yellow-300"],
    ["High", summary.high_count ?? 0, "bg-orange-400"],
    ["Critical", summary.critical_count ?? 0, "bg-red-400"]
  ] as const;

  return (
    <section className="overlay-panel rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-title">Grid Status</h2>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isScanning || loading ? "animate-pulse bg-teal-300" : "bg-emerald-400"}`} />
          <span className="data-mono text-xs font-medium text-zinc-300">
            {isScanning || loading ? "scanning" : `${summary.total_substations ?? nodes.length} substations`}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {boxes.map(([label, value, dot]) => (
          <div key={label} className="flex items-center justify-between border-b border-white/[0.07] pb-2 text-xs">
            <span className="flex items-center gap-2.5 text-zinc-100"><span className={`h-3 w-3 rounded-full ${dot} shadow-[0_0_18px_currentColor]`} />{label}</span>
            <AnimatedNumber value={value} className="data-mono text-sm font-medium text-white" />
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MetricCard label="CAISO stress" value={<AnimatedNumber value={`${Math.round(pct(Number(summary.caiso_demand_stress)) * 100)}%`} />} icon={Gauge} />
        <MetricCard label="Weather risk" value={<AnimatedNumber value={`${Math.round(pct(Number(summary.weather_risk_score)) * 100)}%`} />} icon={CloudSun} />
        <MetricCard label="Overall risk" value={<AnimatedNumber value={`${Math.round(pct(Number(summary.overall_risk_score)) * 100)}%`} />} icon={Activity} />
      </div>
    </section>
  );
}
