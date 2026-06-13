"use client";

import { Activity, Thermometer, Wind, Zap } from "lucide-react";
import { LiveSignals as LiveSignalsType } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";
import MetricCard from "./MetricCard";

// Reads a value from a nested path (e.g. "weather.avg_temp") or a flat key.
// Tries each path in order, returns first non-null value found.
function getNestedValue(signals: LiveSignalsType | undefined, ...paths: string[]): string | number {
  if (!signals || Array.isArray(signals)) return "--";
  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = signals;
    let ok = true;
    for (const part of parts) {
      if (typeof current !== "object" || current === null) { ok = false; break; }
      current = (current as Record<string, unknown>)[part];
    }
    if (ok && current !== undefined && current !== null) return current as string | number;
  }
  return "--";
}

export default function LiveSignals({
  liveSignals,
  loading,
  isScanning
}: {
  liveSignals?: LiveSignalsType;
  loading?: boolean;
  isScanning?: boolean;
  scanVersion?: number;
}) {
  const lastUpdated = !Array.isArray(liveSignals) ? liveSignals?.last_updated as string | undefined : undefined;
  const temp = getNestedValue(liveSignals, "weather.avg_temp", "temperature_f");
  const wind = getNestedValue(liveSignals, "weather.avg_wind", "wind_speed_mph");
  const caiso = getNestedValue(liveSignals, "caiso.np15_current_mw", "caiso_demand_mw");
  const deviation = getNestedValue(liveSignals, "caiso.forecast_deviation_pct", "forecast_deviation_pct");

  return (
    <section className="overlay-panel rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-title">Live Signals</h2>
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-300">
          <span className={`h-1.5 w-1.5 rounded-full ${isScanning || loading ? "animate-pulse bg-teal-300" : "bg-zinc-500"}`} />
          {isScanning || loading ? "scan in progress" : "live"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {/* Backend: weather.avg_temp | Fallback: temperature_f */}
        <MetricCard label="Temp" value={<><AnimatedNumber value={String(temp)} />°F</>} icon={Thermometer} />
        {/* Backend: weather.avg_wind | Fallback: wind_speed_mph */}
        <MetricCard label="Wind" value={<><AnimatedNumber value={String(wind)} /> mph</>} icon={Wind} />
        {/* Backend: caiso.np15_current_mw | Fallback: caiso_demand_mw */}
        <MetricCard label="CAISO" value={<><AnimatedNumber value={String(caiso)} /> MW</>} icon={Zap} />
        {/* Backend: caiso.forecast_deviation_pct | Fallback: forecast_deviation_pct */}
        <MetricCard label="Deviation" value={<><AnimatedNumber value={String(deviation)} />%</>} icon={Activity} />
      </div>
      {lastUpdated && (
        <div className="mt-2 text-right text-[10px] text-zinc-600">
          Updated: {new Date(lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </section>
  );
}
