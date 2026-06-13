import mapboxgl from "mapbox-gl";

function setPaint(map: mapboxgl.Map, layerId: string, property: Parameters<mapboxgl.Map["setPaintProperty"]>[1], value: Parameters<mapboxgl.Map["setPaintProperty"]>[2]) {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // Mapbox base styles vary across versions; skip unavailable paint props.
  }
}

export function tuneWireframeBasemap(map: mapboxgl.Map) {
  setPaint(map, "background", "background-color", "#000000");
  setPaint(map, "water", "fill-color", "#020304");
  setPaint(map, "land", "background-color", "#050505");
  setPaint(map, "landuse", "fill-color", "#060708");
  setPaint(map, "park", "fill-color", "#070908");
  setPaint(map, "building", "fill-color", "#111317");
  setPaint(map, "road-primary", "line-color", "#f3f4f6");
  setPaint(map, "road-primary", "line-opacity", 0.72);
  setPaint(map, "road-secondary-tertiary", "line-color", "#d8dee9");
  setPaint(map, "road-secondary-tertiary", "line-opacity", 0.5);
  setPaint(map, "road-street", "line-color", "#bfc6d1");
  setPaint(map, "road-street", "line-opacity", 0.42);
  setPaint(map, "road-label", "text-color", "#8b929d");
  setPaint(map, "road-label", "text-halo-color", "#000000");
  setPaint(map, "settlement-label", "text-color", "#cbd5e1");
  setPaint(map, "settlement-label", "text-halo-color", "#000000");
  setPaint(map, "poi-label", "text-opacity", 0);
  setPaint(map, "transit-label", "text-opacity", 0);
}

export function addTerrain(map: mapboxgl.Map) {
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14
    });
  }
  if (!map.getSource("terrain-contours")) {
    map.addSource("terrain-contours", {
      type: "vector",
      url: "mapbox://mapbox.mapbox-terrain-v2"
    });
  }
  map.setTerrain({ source: "mapbox-dem", exaggeration: 2.15 });
  map.setFog({
    color: "#000000",
    "high-color": "#1f2937",
    "horizon-blend": 0.04,
    "space-color": "#000000",
    "star-intensity": 0
  });
  if (!map.getLayer("smartgrid-contours")) {
    map.addLayer({
      id: "smartgrid-contours",
      type: "line",
      source: "terrain-contours",
      "source-layer": "contour",
      paint: {
        "line-color": "#f8fafc",
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.08, 14, 0.22],
        "line-width": ["case", ["==", ["%", ["get", "ele"], 100], 0], 0.7, 0.35]
      }
    });
  }
}

export function add3dBuildings(map: mapboxgl.Map) {
  const layers = map.getStyle().layers || [];
  const labelLayer = layers.find((layer) => layer.type === "symbol" && "text-field" in (layer.layout || {}));
  if (map.getLayer("smartgrid-buildings") || !map.getSource("composite")) return;

  map.addLayer(
    {
      id: "smartgrid-buildings",
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 12,
      paint: {
        "fill-extrusion-color": "#242830",
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 12, 0, 15, ["get", "height"]],
        "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 12, 0, 15, ["get", "min_height"]],
        "fill-extrusion-opacity": 0.2
      }
    },
    labelLayer?.id
  );
}
