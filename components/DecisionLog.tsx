import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { DecisionLogEntry, DecisionType } from "@/lib/types";

const styles: Record<DecisionType, { icon: typeof Info; className: string }> = {
  FAULT: { icon: AlertTriangle, className: "border-l-red-400 text-red-300" },
  ACTION: { icon: CheckCircle, className: "border-l-teal-300 text-teal-200" },
  REJECTED: { icon: XCircle, className: "border-l-sky-300 text-sky-200" },
  INFO: { icon: Info, className: "border-l-zinc-500 text-zinc-300" }
};

export default function DecisionLog({ entries }: { entries: DecisionLogEntry[] }) {
  return (
    <section className="overlay-panel rounded-xl p-4">
      <h2 className="panel-title mb-3">Decision Log</h2>
      <div className="soft-scrollbar max-h-60 space-y-1.5 overflow-y-auto pr-1">
        {entries.map((entry) => {
          const Icon = styles[entry.type].icon;
          return (
            <article key={entry.id} className={`rounded-r-xl border border-l-2 border-white/[0.08] bg-white/[0.035] p-3 ${styles[entry.type].className}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold">
                  <Icon className="h-3.5 w-3.5" />
                  {entry.type}
                </div>
                <time className="data-mono text-[10px] text-zinc-600">{new Date(entry.timestamp).toLocaleTimeString()}</time>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-200">{entry.explanation}</p>
              {entry.path?.length ? <div className="data-mono mt-2 text-[10px] text-zinc-400">PATH {entry.path.join(" -> ")}</div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
