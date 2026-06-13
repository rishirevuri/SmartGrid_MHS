import { normalizeStatus } from "@/lib/mapUtils";

const classes = {
  normal: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  elevated: "border-yellow-300/20 bg-yellow-300/10 text-yellow-200",
  high: "border-orange-400/20 bg-orange-400/10 text-orange-300",
  critical: "border-red-400/25 bg-red-400/12 text-red-300"
};

export default function StatusBadge({ status, label }: { status?: string; label?: string }) {
  const normalized = normalizeStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${classes[normalized]}`}>
      {label || normalized}
    </span>
  );
}
