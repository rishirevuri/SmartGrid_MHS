import { GridEdge, GridNode, LiveSignals, RiskSummary } from "./types";

export const fallbackNodes: GridNode[] = [
  { _id: "371", subname: "Sub_371", neighborhood: "SoMa", latitude: 37.7775, longitude: -122.4144, current_load_kw: 18629, load_pct: 1, risk_score: 0.68, status: "high", critical_infrastructure: true, neighbors: ["125", "221"] },
  { _id: "125", subname: "Mission Switching Yard", neighborhood: "Mission", latitude: 37.7599, longitude: -122.4148, current_load_kw: 12880, load_pct: 0.77, risk_score: 0.55, status: "elevated", critical_infrastructure: false, neighbors: ["371", "221", "884"] },
  { _id: "221", subname: "Downtown Core Substation", neighborhood: "Downtown", latitude: 37.7936, longitude: -122.3999, current_load_kw: 21450, load_pct: 0.91, risk_score: 0.74, status: "critical", critical_infrastructure: true, neighbors: ["371", "125", "704"] },
  { _id: "884", subname: "Noe Valley Feeder Hub", neighborhood: "Noe Valley", latitude: 37.7502, longitude: -122.4337, current_load_kw: 7900, load_pct: 0.43, risk_score: 0.28, status: "normal", critical_infrastructure: false, neighbors: ["125", "512"] },
  { _id: "512", subname: "Bayview Reliability Node", neighborhood: "Bayview", latitude: 37.7289, longitude: -122.3927, current_load_kw: 11100, load_pct: 0.63, risk_score: 0.46, status: "elevated", critical_infrastructure: true, neighbors: ["884", "125"] },
  { _id: "607", subname: "Sunset West Substation", neighborhood: "Sunset", latitude: 37.7531, longitude: -122.4944, current_load_kw: 6200, load_pct: 0.36, risk_score: 0.2, status: "normal", critical_infrastructure: false, neighbors: ["309", "884"] },
  { _id: "309", subname: "Richmond Relay Yard", neighborhood: "Richmond", latitude: 37.7799, longitude: -122.4662, current_load_kw: 8400, load_pct: 0.49, risk_score: 0.31, status: "normal", critical_infrastructure: false, neighbors: ["607", "704"] },
  { _id: "704", subname: "Marina Emergency Feed", neighborhood: "Marina", latitude: 37.8038, longitude: -122.4368, current_load_kw: 9100, load_pct: 0.58, risk_score: 0.39, status: "normal", critical_infrastructure: true, neighbors: ["309", "221"] },
  { _id: "940", subname: "UCSF Hospital Microgrid", neighborhood: "UCSF / Hospital", latitude: 37.763, longitude: -122.4586, current_load_kw: 13600, load_pct: 0.82, risk_score: 0.62, status: "high", critical_infrastructure: true, neighbors: ["309", "884"] }
];

export const fallbackEdges: GridEdge[] = [
  { _id: "f-371-125", from_node: "371", to_node: "125", capacity_kw: 19000, current_load_kw: 15400, current_load_pct: 0.81, status: "high" },
  { _id: "f-371-221", from_node: "371", to_node: "221", capacity_kw: 22000, current_load_kw: 19800, current_load_pct: 0.9, status: "critical" },
  { _id: "f-125-884", from_node: "125", to_node: "884", capacity_kw: 16000, current_load_kw: 9400, current_load_pct: 0.59, status: "normal" },
  { _id: "f-125-512", from_node: "125", to_node: "512", capacity_kw: 13000, current_load_kw: 8500, current_load_pct: 0.65, status: "elevated" },
  { _id: "f-884-607", from_node: "884", to_node: "607", capacity_kw: 12000, current_load_kw: 4100, current_load_pct: 0.34, status: "normal" },
  { _id: "f-607-309", from_node: "607", to_node: "309", capacity_kw: 11000, current_load_kw: 5200, current_load_pct: 0.47, status: "normal" },
  { _id: "f-309-704", from_node: "309", to_node: "704", capacity_kw: 15000, current_load_kw: 7600, current_load_pct: 0.51, status: "normal" },
  { _id: "f-704-221", from_node: "704", to_node: "221", capacity_kw: 18000, current_load_kw: 11100, current_load_pct: 0.62, status: "elevated" },
  { _id: "f-940-309", from_node: "940", to_node: "309", capacity_kw: 14000, current_load_kw: 10100, current_load_pct: 0.72, status: "elevated" },
  { _id: "f-940-884", from_node: "940", to_node: "884", capacity_kw: 9000, current_load_kw: 6000, current_load_pct: 0.67, status: "elevated" }
];

export const fallbackRiskSummary: RiskSummary = {
  status: "high",
  normal_count: 4,
  elevated_count: 2,
  high_count: 2,
  critical_count: 1,
  caiso_demand_stress: 0.72,
  weather_risk_score: 0.42,
  overall_risk_score: 0.56,
  total_substations: 9
};

export const fallbackLiveSignals: LiveSignals = {
  temperature_f: 67,
  wind_speed_mph: 18,
  caiso_demand_mw: 28410,
  forecast_deviation_pct: 7.6,
  active_alert_nodes: 3,
  alerts: [
    { id: "sig-1", type: "Load spike", source: "CAISO telemetry", severity: "high", affected_neighborhood: "SoMa", affected_node: "371", summary: "Peak feeder draw exceeds safe operating threshold.", timestamp: new Date().toISOString() },
    { id: "sig-2", type: "Hospital protection", source: "Critical asset monitor", severity: "elevated", affected_neighborhood: "UCSF / Hospital", affected_node: "940", summary: "Redundant feed requested for hospital microgrid.", timestamp: new Date().toISOString() }
  ]
};
