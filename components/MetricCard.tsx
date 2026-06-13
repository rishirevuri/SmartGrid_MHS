import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

export default function MetricCard({ label, value, tone = "cyan", icon: Icon }: { label: string; value: string | number | ReactNode; tone?: "cyan" | "green" | "amber" | "red"; icon?: LucideIcon }) {
  const tones = {
    cyan: "after:bg-sky-400",
    green: "after:bg-emerald-400",
    amber: "after:bg-yellow-300",
    red: "after:bg-red-400"
  };

  return (
    <div className={`relative overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.035] p-2.5 after:absolute after:left-0 after:top-0 after:h-full after:w-px ${tones[tone]}`}>
      <div className="flex items-center justify-between text-[10px] font-medium text-zinc-300">
        <span>{label}</span>
        {Icon ? <Icon className="h-3 w-3 text-zinc-300" /> : null}
      </div>
      <div className="data-mono mt-1.5 text-sm font-medium tracking-tight text-white">{value}</div>
    </div>
  );
}
