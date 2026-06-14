"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import mapboxgl from "mapbox-gl";
import { GridEdge, GridNode } from "@/lib/types";
import { edgeFeatureCollection, getNodeCoordinates, nodeFeatureCollection, pathFeatureCollection } from "@/lib/mapUtils";
import { add3dBuildings, addTerrain, tuneWireframeBasemap } from "@/lib/mapLayers";
import MapControls from "./MapControls";
import MapLegend from "./MapLegend";
import NodePopup from "./NodePopup";

const INITIAL_VIEW = {
  center: [-122.426, 37.777] as [number, number],
  zoom: 11.95,
  pitch: 62,
  bearing: -24
};

const bridgeData: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Golden Gate Bridge" },
      geometry: { type: "LineString", coordinates: [[-122.4786, 37.8199], [-122.475, 37.8175], [-122.4693, 37.8121]] }
    },
    {
      type: "Feature",
      properties: { name: "Bay Bridge" },
      geometry: { type: "LineString", coordinates: [[-122.3925, 37.7898], [-122.379, 37.7962], [-122.362, 37.806]] }
    }
  ]
};

function setSourceData(map: mapboxgl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  source?.setData(data);
}

function setLayerVisibility(map: mapboxgl.Map, ids: string[], enabled: boolean) {
  ids.forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", enabled ? "visible" : "none");
  });
}

export default function GridMap({
  nodes,
  edges,
  selectedNode,
  cascadeNodeIds,
  reroutePath,
  dangerPath,
  onSelectNode,
  onSimulate,
  demoMode
}: {
  nodes: GridNode[];
  edges: GridEdge[];
  selectedNode?: GridNode;
  cascadeNodeIds: string[];
  reroutePath?: string[];
  dangerPath?: string[];
  onSelectNode: (node: GridNode) => void;
  onSimulate: (node: GridNode) => void;
  demoMode: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const nodesRef = useRef<GridNode[]>(nodes);
  const hoverIdRef = useRef<string | number | undefined>();
  const nearFeederIdsRef = useRef<Set<number | string>>(new Set());
  const rafRef = useRef<number | undefined>();
  const pulseAnimRef = useRef<number | undefined>();
  const pulsePhaseRef = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [alertFlash, setAlertFlash] = useState(false);
  const [mapError, setMapError] = useState<string>();
  const [layers, setLayers] = useState({
    Feeders: true,
    "Cascade Path": true,
    "Recommended Reroute": true,
    "Major Labels": true
  });

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const hasUsableToken = Boolean(token && token !== "your_mapbox_token_here");
  const nodeData = useMemo(() => nodeFeatureCollection(nodes, cascadeNodeIds, selectedNode?._id), [nodes, cascadeNodeIds, selectedNode?._id]);
  const edgeData = useMemo(() => edgeFeatureCollection(nodes, edges), [nodes, edges]);
  const rerouteData = useMemo(() => pathFeatureCollection(nodes, reroutePath), [nodes, reroutePath]);
  const dangerData = useMemo(() => pathFeatureCollection(nodes, dangerPath), [nodes, dangerPath]);

  useEffect(() => {
    nodesRef.current = nodes;
    if (process.env.NODE_ENV !== "production") {
      const validNodeCount = nodeFeatureCollection(nodes).features.length;
      if (nodes.length && validNodeCount === 0) console.warn("SmartGrid map: no valid node coordinates available", nodes.slice(0, 3));
    }
  }, [nodes]);

  useEffect(() => {
    if (!hasUsableToken || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token as string;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      ...INITIAL_VIEW,
      minZoom: 11.2,
      maxZoom: 15.8,
      maxBounds: [[-122.54, 37.69], [-122.34, 37.84]],
      attributionControl: false
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    map.on("error", (event) => {
      const message = event.error?.message || "Mapbox failed to render the map.";
      setMapError(message);
    });

    map.on("load", () => {
      tuneWireframeBasemap(map);
      addTerrain(map);
      add3dBuildings(map);
      map.addSource("feeders", { type: "geojson", data: edgeData, generateId: true });
      map.addSource("nodes", { type: "geojson", data: nodeData, promoteId: "id" });
      map.addSource("reroute", { type: "geojson", data: rerouteData });
      map.addSource("danger", { type: "geojson", data: dangerData });
      map.addSource("bridges", { type: "geojson", data: bridgeData });

      map.addLayer({ id: "bridge-shadow", type: "line", source: "bridges", paint: { "line-color": "#000000", "line-opacity": 0.68, "line-width": 9, "line-blur": 4, "line-translate": [3, 5] } });
      map.addLayer({ id: "bridge-cable-glow", type: "line", source: "bridges", paint: { "line-color": "#f8fafc", "line-opacity": 0.2, "line-width": 7, "line-blur": 2 } });
      map.addLayer({ id: "bridge-main", type: "line", source: "bridges", paint: { "line-color": "#e5e7eb", "line-opacity": 0.86, "line-width": 2.2, "line-dasharray": [1.2, 0.75] } });
      // Ambient layer: thin transparent yellow — always shows the full network faintly
      map.addLayer({ id: "feeders-casing", type: "line", source: "feeders", paint: { "line-color": "#facc15", "line-opacity": 0.11, "line-width": 0.55 } });
      // Proximity layer: opaque orange/yellow only for features near the cursor (feature-state "near")
      map.addLayer({ id: "feeders-main", type: "line", source: "feeders", paint: {
        "line-color": ["case", ["boolean", ["feature-state", "near"], false], ["get", "color"], "#facc15"],
        "line-opacity": ["case", ["boolean", ["feature-state", "near"], false], 0.88, 0.0],
        "line-width": ["case", ["boolean", ["feature-state", "near"], false], 1.4, 0.0]
      } });
      // Cascade/failure path — wide area glow makes the danger corridor visible
      map.addLayer({ id: "danger-area", type: "line", source: "danger", paint: { "line-color": "#ef4444", "line-opacity": 0.07, "line-width": 48, "line-blur": 12 } });
      map.addLayer({ id: "danger-glow", type: "line", source: "danger", paint: { "line-color": "#ef4444", "line-opacity": 0.26, "line-width": 14, "line-blur": 3 } });
      map.addLayer({ id: "danger-main", type: "line", source: "danger", paint: { "line-color": "#fca5a5", "line-opacity": 0.96, "line-width": 4.0, "line-dasharray": [2, 1.2] } });
      // Reroute path — bright mint green with soft area highlight
      map.addLayer({ id: "reroute-area", type: "line", source: "reroute", paint: { "line-color": "#4ade80", "line-opacity": 0.07, "line-width": 48, "line-blur": 12 } });
      map.addLayer({ id: "reroute-glow", type: "line", source: "reroute", paint: { "line-color": "#86efac", "line-opacity": 0.30, "line-width": 16, "line-blur": 3 } });
      map.addLayer({ id: "reroute-main", type: "line", source: "reroute", paint: { "line-color": "#4ade80", "line-opacity": 0.96, "line-width": 3.6, "line-dasharray": [1.1, 0.9] } });

      map.addLayer({ id: "node-halo", type: "circle", source: "nodes", paint: { "circle-radius": ["case", ["get", "cascade"], 22, ["get", "selected"], 20, ["get", "critical"], 17, 13], "circle-color": ["case", ["get", "cascade"], "#ef4444", ["get", "selected"], "#38bdf8", ["get", "color"]], "circle-opacity": ["case", ["get", "selected"], 0.28, ["get", "critical"], 0.24, 0.18], "circle-blur": 0.82 } });
      map.addLayer({ id: "node-outer", type: "circle", source: "nodes", paint: { "circle-radius": ["case", ["boolean", ["feature-state", "hover"], false], 10.5, ["get", "selected"], 10.5, ["get", "critical"], 9.5, 8], "circle-color": "#0a0a0a", "circle-opacity": 0.96, "circle-stroke-color": ["case", ["get", "selected"], "#38bdf8", ["get", "cascade"], "#ef4444", ["get", "color"]], "circle-stroke-width": ["case", ["get", "selected"], 2.6, ["get", "critical"], 2, 1.4] } });
      map.addLayer({ id: "node-core", type: "circle", source: "nodes", paint: { "circle-radius": ["case", ["boolean", ["feature-state", "hover"], false], 4.8, 3.8], "circle-color": ["case", ["get", "cascade"], "#ef4444", ["get", "color"]], "circle-opacity": 1 } });
      map.addLayer({ id: "node-critical-ring", type: "circle", source: "nodes", filter: ["==", ["get", "critical"], true], paint: { "circle-radius": 13, "circle-color": "rgba(255,255,255,0)", "circle-stroke-color": "#e5e7eb", "circle-stroke-width": 1, "circle-stroke-opacity": 0.72 } });
      map.addLayer({ id: "node-hit", type: "circle", source: "nodes", paint: { "circle-radius": 20, "circle-color": "#000000", "circle-opacity": 0 } });
      map.addLayer({ id: "node-labels", type: "symbol", source: "nodes", filter: ["any", ["get", "critical"], ["get", "selected"], [">=", ["get", "risk"], 0.28]], layout: { "text-field": ["get", "label"], "text-size": 12, "text-offset": [0, 1.7], "text-anchor": "top", "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"], "text-allow-overlap": false, "text-max-width": 10 }, paint: { "text-color": "#1e293b", "text-halo-color": "#ffffff", "text-halo-width": 1.8, "text-opacity": 0.92 } });

      map.on("click", "node-hit", (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        const node = nodesRef.current.find((candidate) => candidate._id === id);
        if (node) onSelectNode(node);
      });
      map.on("mousemove", "node-hit", (event) => {
        const id = event.features?.[0]?.id;
        if (hoverIdRef.current !== undefined && hoverIdRef.current !== id) {
          map.setFeatureState({ source: "nodes", id: hoverIdRef.current }, { hover: false });
        }
        hoverIdRef.current = id;
        if (id !== undefined) map.setFeatureState({ source: "nodes", id }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "node-hit", () => {
        if (hoverIdRef.current !== undefined) map.setFeatureState({ source: "nodes", id: hoverIdRef.current }, { hover: false });
        hoverIdRef.current = undefined;
        map.getCanvas().style.cursor = "";
      });

      // Cursor-proximity feeder highlighting: lines near the cursor become opaque orange/yellow,
      // distant lines stay faintly transparent. Use rAF to throttle to one update per frame.
      map.on("mousemove", (e) => {
        if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          nearFeederIdsRef.current.forEach((id) => {
            map.setFeatureState({ source: "feeders", id }, { near: false });
          });
          nearFeederIdsRef.current.clear();
          const { x, y } = e.point;
          const r = 88;
          map.queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers: ["feeders-casing"] })
            .forEach((f) => {
              if (f.id !== undefined) {
                map.setFeatureState({ source: "feeders", id: f.id }, { near: true });
                nearFeederIdsRef.current.add(f.id as number | string);
              }
            });
        });
      });

      map.on("mouseleave", () => {
        if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
        nearFeederIdsRef.current.forEach((id) => {
          map.setFeatureState({ source: "feeders", id }, { near: false });
        });
        nearFeederIdsRef.current.clear();
      });

      setLoaded(true);
    });

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      if (pulseAnimRef.current !== undefined) cancelAnimationFrame(pulseAnimRef.current);
      popupRootRef.current?.unmount();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [hasUsableToken, token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    setSourceData(map, "nodes", nodeData);
    setSourceData(map, "feeders", edgeData);
    setSourceData(map, "reroute", rerouteData);
    setSourceData(map, "danger", dangerData);
  }, [loaded, nodeData, edgeData, rerouteData, dangerData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    setLayerVisibility(map, ["feeders-casing", "feeders-main"], layers.Feeders);
    setLayerVisibility(map, ["danger-area", "danger-glow", "danger-main"], layers["Cascade Path"]);
    setLayerVisibility(map, ["reroute-area", "reroute-glow", "reroute-main"], layers["Recommended Reroute"]);
    setLayerVisibility(map, ["node-labels"], layers["Major Labels"]);
  }, [layers, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    const coordinates = getNodeCoordinates(selectedNode);
    if (!map || !loaded || !selectedNode || !coordinates) return;
    popupRootRef.current?.unmount();
    popupRef.current?.remove();
    const element = document.createElement("div");
    popupRootRef.current = createRoot(element);
    popupRootRef.current.render(<NodePopup node={selectedNode} onSimulate={onSimulate} />);
    popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 22, maxWidth: "340px" }).setLngLat(coordinates).setDOMContent(element).addTo(map);
  }, [selectedNode, loaded, onSimulate]);

  // Trigger screen flash once when a new cascade simulation starts
  const flashTrigger = cascadeNodeIds.length > 0 ? cascadeNodeIds[0] : null;
  useEffect(() => {
    if (!flashTrigger) return;
    setAlertFlash(true);
    const t = window.setTimeout(() => setAlertFlash(false), 900);
    return () => window.clearTimeout(t);
  }, [flashTrigger]);

  // Pulse the node-halo radius/opacity for cascade (failed) nodes via rAF
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    if (cascadeNodeIds.length === 0) {
      if (pulseAnimRef.current !== undefined) cancelAnimationFrame(pulseAnimRef.current);
      pulseAnimRef.current = undefined;
      if (map.getLayer("node-halo")) {
        map.setPaintProperty("node-halo", "circle-radius",
          ["case", ["get", "cascade"], 22, ["get", "selected"], 20, ["get", "critical"], 17, 13]);
        map.setPaintProperty("node-halo", "circle-opacity",
          ["case", ["get", "selected"], 0.28, ["get", "critical"], 0.24, 0.18]);
      }
      return;
    }

    pulsePhaseRef.current = 0;
    function tick() {
      const m = mapRef.current;
      if (!m || !m.getLayer("node-halo")) return;
      pulsePhaseRef.current += 0.07;
      const p = Math.abs(Math.sin(pulsePhaseRef.current));
      m.setPaintProperty("node-halo", "circle-radius",
        ["case", ["get", "cascade"], Math.round(28 + 22 * p), ["get", "selected"], 20, ["get", "critical"], 17, 13]);
      m.setPaintProperty("node-halo", "circle-opacity",
        ["case", ["get", "cascade"], parseFloat((0.16 + 0.54 * p).toFixed(3)), ["get", "selected"], 0.28, ["get", "critical"], 0.24, 0.18]);
      pulseAnimRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      if (pulseAnimRef.current !== undefined) cancelAnimationFrame(pulseAnimRef.current);
      pulseAnimRef.current = undefined;
    };
  }, [cascadeNodeIds, loaded]);

  if (!hasUsableToken) {
    return (
      <div className="console-panel flex h-full items-center justify-center p-8 text-center">
        <div>
          <div className="text-xl font-semibold text-zinc-50">Mapbox token required</div>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">Set <span className="data-mono rounded bg-white/10 px-1.5 py-0.5 text-zinc-200">NEXT_PUBLIC_MAPBOX_TOKEN</span> in <span className="data-mono">.env.local</span>. The placeholder value is treated as missing so the app does not fail as a blank map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-shell relative h-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="map-ice-overlay" />
      {alertFlash && (
        <div className="pointer-events-none absolute inset-0 z-40" style={{ animation: "cascadeFlash 0.9s ease-out forwards" }} />
      )}
      {!loaded ? <div className="absolute inset-0 z-30 animate-pulse bg-slate-100/80" /> : null}
      {mapError ? <div className="glass-chip absolute left-5 right-5 top-5 z-30 rounded-2xl px-4 py-3 text-sm text-red-700">{mapError}</div> : null}
      <div className="dark-chip absolute left-6 top-6 z-20 rounded-xl px-4 py-3">
        <div className="text-xl font-extrabold tracking-tight text-zinc-50">SmartGrid Digital Twin</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">San Francisco Operating Region</div>
      </div>
      <div className="absolute left-6 top-[6.6rem] z-20 flex items-center gap-2">
        {demoMode ? <span className="dark-chip rounded-full px-3.5 py-2 text-xs font-medium text-yellow-200">Demo fallback</span> : null}
        <span className="dark-chip rounded-full px-3.5 py-2 text-xs font-medium text-zinc-200"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-teal-300" />Live</span>
      </div>
      <MapControls onReset={() => mapRef.current?.flyTo(INITIAL_VIEW)} layers={layers} setLayers={setLayers} />
      <MapLegend />
    </div>
  );
}
