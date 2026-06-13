export type GridStatus = "normal" | "elevated" | "high" | "critical";

export interface GridNode {
  _id: string;
  subname?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  current_load_kw?: number;
  load_pct?: number;
  risk_score?: number;
  status?: GridStatus | string;
  critical_infrastructure?: boolean;
  live_signals?: unknown[];
  neighbors?: string[];
}

export interface GridEdge {
  _id: string;
  from_node?: string;
  to_node?: string;
  capacity_kw?: number;
  current_load_kw?: number;
  current_load_pct?: number;
  status?: GridStatus | string;
  geometry?: { type: string; coordinates: unknown };
}

export interface RiskSummary {
  status?: GridStatus | string;
  normal_count?: number;
  elevated_count?: number;
  high_count?: number;
  critical_count?: number;
  caiso_demand_stress?: number;
  weather_risk_score?: number;
  overall_risk_score?: number;
  total_substations?: number;
  // Backend API field names (normalized in normalizeRiskSummary)
  grid_stress_level?: string;
  demand_stress_score?: number;
  critical_nodes?: number;
  high_critical_nodes?: number;
  total_nodes?: number;
  [key: string]: unknown;
}

export interface LiveSignal {
  id?: string;
  type?: string;
  source?: string;
  severity?: string;
  affected_neighborhood?: string;
  affected_node?: string;
  summary?: string;
  timestamp?: string;
  value?: string | number;
  [key: string]: unknown;
}

export type LiveSignals = LiveSignal[] | Record<string, unknown>;

export interface CascadeSimulation {
  failed_node_id?: string;
  affected_nodes?: string[];
  cascade_path?: string[];
  explanation?: string;
  [key: string]: unknown;
}

export interface RerouteOption {
  path: string[];
  score: number;
  explanation: string;
}

export interface RerouteSimulation {
  failed_node_id?: string;
  reroute_options?: RerouteOption[];
  recommended_path?: string[];
  reroute_path?: string[];
  rejected_path?: string[];
  alternative_path?: string[];
  explanation?: string;
  rejected_reason?: string;
  [key: string]: unknown;
}

export type DecisionType = "FAULT" | "ACTION" | "REJECTED" | "INFO";

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  type: DecisionType;
  explanation: string;
  affectedNodes?: string[];
  path?: string[];
}

export interface AgentResponse {
  response?: string;
  answer?: string;
  text?: string;
  provider?: "backboard" | "local-fallback" | string;
  thread_id?: string;
  assistant_id?: string;
  backboard_error?: string;
  [key: string]: unknown;
}
