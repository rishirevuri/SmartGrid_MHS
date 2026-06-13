import { NextResponse } from "next/server";
import { gridSnapshot, gridStressLevel } from "@/lib/server/gridModel";

export async function GET() {
  try {
    const snapshot = await gridSnapshot();
    const nodes = snapshot.nodes;
    const highest = [...nodes].sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))[0];
    const avgRisk = nodes.reduce((sum, node) => sum + Number(node.risk_score || 0), 0) / Math.max(nodes.length, 1);
    const criticalNodes = snapshot.counts.critical;
    const highRiskNodes = snapshot.counts.high + snapshot.counts.critical;

    return NextResponse.json({
      highest_risk_node: {
        _id: highest?._id,
        subname: highest?.subname,
        risk_score: highest?.risk_score,
        status: highest?.status
      },
      critical_nodes: criticalNodes,
      high_critical_nodes: highRiskNodes,
      high_risk_nodes: highRiskNodes,
      weather_risk_score: snapshot.currentWeather.weather_risk_score || 0,
      demand_stress_score: snapshot.currentCaiso.system_stress_score || 0.5,
      grid_stress_level: gridStressLevel(avgRisk),
      total_nodes: nodes.length,
      grid_readiness_score: snapshot.sustainability.grid_readiness_score,
      sustainable_grid_readiness: snapshot.sustainability.sustainable_grid_readiness,
      cascade_risk_reduction: snapshot.sustainability.cascade_risk_reduction,
      diesel_backup_avoided_minutes: snapshot.sustainability.diesel_backup_avoided_minutes,
      critical_sites_protected: snapshot.sustainability.critical_sites_protected
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load risk summary" },
      { status: 503 }
    );
  }
}
