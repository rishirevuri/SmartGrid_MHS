import { RotateCcw } from "lucide-react";

export default function MapControls<T extends Record<string, boolean>>({ onReset, layers, setLayers }: { onReset: () => void; layers: T; setLayers: (layers: T) => void }) {
  return (
    <div className="dark-chip absolute bottom-5 left-5 z-20 rounded-2xl p-2.5">
      <button onClick={onReset} className="mb-2 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.11]">
        <RotateCcw className="h-3.5 w-3.5" />
        Reset View
      </button>
      <div className="grid gap-1.5">
        {Object.entries(layers).map(([key, enabled]) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-1.5 py-1 text-[11px] font-medium text-zinc-400">
            <span>{key}</span>
            <button
              type="button"
              aria-pressed={enabled}
              onClick={() => setLayers({ ...layers, [key]: !enabled })}
              className={`h-4 w-7 rounded-full border transition ${enabled ? "border-sky-300/40 bg-sky-400/80" : "border-white/15 bg-white/10"}`}
            >
              <span className={`block h-3 w-3 rounded-full bg-white transition ${enabled ? "translate-x-3" : "translate-x-0.5"}`} />
            </button>
          </label>
        ))}
      </div>
    </div>
  );
}
