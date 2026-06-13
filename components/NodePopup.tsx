import { AlertTriangle, Shield, Zap } from "lucide-react";
import { GridNode } from "@/lib/types";
import { pct } from "@/lib/mapUtils";
import StatusBadge from "./StatusBadge";

export default function NodePopup({ node, onSimulate }: { node: GridNode; onSimulate: (node: GridNode) => void }) {
  return (
    <div className="w-80 rounded-2xl border border-white/10 bg-[#090b0f]/95 p-4 text-zinc-100 shadow-2xl shadow-black/45 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold tracking-tight text-zinc-50">{node.subname || node._id}</div>
          <div className="mt-0.5 text-xs text-zinc-500">{node.neighborhood || "Unknown sector"}</div>
        </div>
        <StatusBadge status={node.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500"><AlertTriangle className="h-3 w-3" /> Risk</div>
          <div className="data-mono mt-1 text-lg font-semibold text-zinc-50">{Math.round(pct(node.risk_score) * 100)}%</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500"><Zap className="h-3 w-3" /> Load</div>
          <div className="data-mono mt-1 text-lg font-semibold text-zinc-50">{Math.round(pct(node.load_pct) * 100)}%</div>
        </div>
      </div>
      {node.critical_infrastructure ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-xs font-medium text-teal-200">
          <Shield className="h-3 w-3" />
          Critical infrastructure
        </div>
      ) : null}
      <button onClick={() => onSimulate(node)} className="mt-4 w-full rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-400">
        Simulate Grid Stress
      </button>
    </div>
  );
}
