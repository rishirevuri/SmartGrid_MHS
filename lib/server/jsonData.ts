import { readFile } from "fs/promises";
import path from "path";
import { GridEdge, GridNode } from "@/lib/types";

type DatasetName = "nodes" | "edges" | "weather" | "caiso";

const DATA_FILES: Record<DatasetName, string> = {
  nodes: "sf_grid_nodes.json",
  edges: "sf_grid_edges.json",
  weather: "weather_signals.json",
  caiso: "caiso_demand_signals.json"
};

const cache = new Map<DatasetName, unknown>();

async function readJson<T>(dataset: DatasetName): Promise<T> {
  if (cache.has(dataset)) return structuredClone(cache.get(dataset)) as T;

  const filePath = path.join(process.cwd(), "data", DATA_FILES[dataset]);
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as T;
    cache.set(dataset, parsed);
    return structuredClone(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(`SmartGrid data file missing or invalid: ${filePath}. ${message}`);
  }
}

export async function getGridNodes(): Promise<GridNode[]> {
  return readJson<GridNode[]>("nodes");
}

export async function getGridEdges(): Promise<GridEdge[]> {
  return readJson<GridEdge[]>("edges");
}

export async function getWeatherSignals(): Promise<Record<string, unknown>> {
  return readJson<Record<string, unknown>>("weather");
}

export async function getCaisoSignals(): Promise<Record<string, unknown>> {
  return readJson<Record<string, unknown>>("caiso");
}

export async function getDataCounts() {
  const [nodes, edges] = await Promise.all([getGridNodes(), getGridEdges()]);
  return { nodes: nodes.length, edges: edges.length };
}
