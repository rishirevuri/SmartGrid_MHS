const items = [
  ["Normal", "#22c55e"],
  ["Elevated", "#eab308"],
  ["High", "#f97316"],
  ["Critical", "#ef4444"],
  ["Reroute", "#22c55e"]
];

export default function MapLegend() {
  return (
    <div className="dark-chip absolute bottom-5 right-5 z-20 rounded-2xl p-3">
      <div className="section-label mb-2 text-zinc-500">Legend</div>
      <div className="space-y-1.5">
        {items.map(([label, color]) => (
          <div key={label} className="flex items-center gap-2 text-[11px] font-medium text-zinc-300">
            <span className="h-2 w-2 rounded-full ring-1 ring-white/30" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
