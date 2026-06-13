import { NextResponse } from "next/server";
import { gridSnapshot } from "@/lib/server/gridModel";

export async function GET() {
  try {
    const snapshot = await gridSnapshot();
    const alertNodes = snapshot.nodes.filter((node) => node.status === "high" || node.status === "critical");
    const avgLoad = snapshot.nodes.reduce((sum, node) => sum + Number(node.load_pct || 0), 0) / Math.max(snapshot.nodes.length, 1);
    const weatherRisk = Number(snapshot.currentWeather.weather_risk_score || 0);
    const demandStress = Number(snapshot.currentCaiso.system_stress_score || 0.5);

    return NextResponse.json({
      weather: snapshot.currentWeather,
      caiso: snapshot.currentCaiso,
      alert_nodes: alertNodes,
      last_updated: new Date().toISOString(),
      climate_stress: weatherRisk,
      demand_stress: demandStress,
      renewable_readiness: Math.round((1 - Math.max(weatherRisk, demandStress) * 0.35) * 100),
      weather_risk: weatherRisk,
      grid_load: Number(avgLoad.toFixed(4))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load live signals" },
      { status: 503 }
    );
  }
}
