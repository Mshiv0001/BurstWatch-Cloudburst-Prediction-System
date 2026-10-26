import { useEffect, useState, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { 
  Navigation, 
  Eye, 
  RefreshCw, 
  Zap, 
  Info,
  Radio,
  Wind
} from "lucide-react";
import { 
  STATIONS_DATA, 
  computeSpotWeather 
} from "../data/mockData";

// Extended Cities for Wind & Temperature Map (Matching Screenshot)
const WIND_MAP_CITIES = [
  { name: "New Delhi", temp: 33, lon: 77.20, lat: 28.61 },
  { name: "Bikaner", temp: 35, lon: 73.31, lat: 28.02 },
  { name: "Jaipur", temp: 32, lon: 75.78, lat: 26.91 },
  { name: "Jodhpur", temp: 32, lon: 73.02, lat: 26.23 },
  { name: "Sukkur", temp: 34, lon: 68.85, lat: 27.70 },
  { name: "Karachi", temp: 29, lon: 67.00, lat: 24.86 },
  { name: "Turbat", temp: 31, lon: 63.05, lat: 26.00 },
  { name: "Okha", temp: 28, lon: 69.07, lat: 22.46 },
  { name: "Surat", temp: 30, lon: 72.83, lat: 21.17 },
  { name: "Indore", temp: 26, lon: 75.85, lat: 22.71 },
  { name: "Nagpur", temp: 27, lon: 79.08, lat: 21.14 },
  { name: "Prayagraj", temp: 29, lon: 81.84, lat: 25.43 },
  { name: "Mumbai", temp: 27, lon: 72.87, lat: 19.07 },
  { name: "Belagavi", temp: 25, lon: 74.50, lat: 15.84 },
  { name: "Hyderabad", temp: 29, lon: 78.48, lat: 17.38 },
  { name: "Visakhapatnam", temp: 33, lon: 83.21, lat: 17.68 },
  { name: "Bhubaneshwar", temp: 32, lon: 85.82, lat: 20.29 },
  { name: "Dhanbad", temp: 29, lon: 86.43, lat: 23.79 },
  { name: "Kathmandu", temp: 23, lon: 85.32, lat: 27.71 },
  { name: "Purang", temp: 12, lon: 81.17, lat: 30.30 },
  { name: "Zhongba", temp: 9, lon: 84.03, lat: 29.76 }
];

// Helper: Generate GeoJSON polygon for circular radar coverage disk
function generateCirclePolygon(centerLon, centerLat, radiusKm = 400, points = 64) {
  const coords = [];
  const distanceX = radiusKm / (111.320 * Math.cos(centerLat * Math.PI / 180));
  const distanceY = radiusKm / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([centerLon + x, centerLat + y]);
  }

  return coords;
}

// Major Radar Stations providing Coverage Footprints
const RADAR_COVERAGE_CENTERS = [
  { name: "Delhi", lon: 77.10, lat: 28.70, radius: 450 },
  { name: "Jaipur", lon: 75.80, lat: 26.90, radius: 420 },
  { name: "Lucknow/Prayagraj", lon: 81.20, lat: 26.50, radius: 460 },
  { name: "Patna", lon: 85.13, lat: 25.59, radius: 440 },
  { name: "Kolkata", lon: 88.36, lat: 22.57, radius: 460 },
  { name: "Dhaka", lon: 90.41, lat: 23.81, radius: 440 },
  { name: "Nagpur", lon: 79.08, lat: 21.14, radius: 450 },
  { name: "Bhubaneshwar", lon: 85.82, lat: 20.29, radius: 450 },
  { name: "Visakhapatnam", lon: 83.21, lat: 17.68, radius: 450 },
  { name: "Mumbai", lon: 72.87, lat: 19.07, radius: 450 },
  { name: "Surat", lon: 72.83, lat: 21.17, radius: 420 },
  { name: "Bengaluru", lon: 77.59, lat: 12.97, radius: 440 },
  { name: "Chennai", lon: 80.27, lat: 13.08, radius: 440 },
  { name: "Karachi", lon: 67.00, lat: 24.86, radius: 440 },
  { name: "Lahore", lon: 74.35, lat: 31.52, radius: 440 },
  { name: "Srinagar", lon: 74.79, lat: 34.08, radius: 420 }
];

const RADAR_COVERAGE_DISKS_GEOJSON = {
  type: "FeatureCollection",
  features: RADAR_COVERAGE_CENTERS.map((dwr) => ({
    type: "Feature",
    properties: { name: dwr.name },
    geometry: {
      type: "Polygon",
      coordinates: [generateCirclePolygon(dwr.lon, dwr.lat, dwr.radius)]
    }
  }))
};

// High-Definition Radar Reflectivity Echo Clusters
const RADAR_REFLECTIVITY_ECHOES_GEOJSON = {
  type: "FeatureCollection",
  features: [
    // Gangetic Basin / UP
    {
      type: "Feature",
      properties: { tier: "blue" },
      geometry: {
        type: "Polygon",
        coordinates: [[[76.8, 29.5], [80.5, 29.6], [82.8, 27.8], [83.5, 25.5], [82.2, 24.8], [79.8, 25.8], [78.2, 27.2], [76.8, 29.5]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "cyan" },
      geometry: {
        type: "Polygon",
        coordinates: [[[77.4, 29.0], [80.0, 29.2], [82.2, 27.5], [82.8, 25.8], [81.8, 25.2], [79.4, 26.2], [78.0, 27.6], [77.4, 29.0]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "green" },
      geometry: {
        type: "Polygon",
        coordinates: [[[78.0, 28.6], [79.6, 28.8], [81.6, 27.2], [82.2, 26.0], [81.4, 25.6], [79.0, 26.6], [78.0, 28.6]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "yellow" },
      geometry: {
        type: "Polygon",
        coordinates: [[[78.4, 28.2], [79.2, 28.4], [80.8, 27.4], [81.5, 26.4], [80.8, 26.2], [79.4, 27.0], [78.4, 28.2]]]
      }
    },
    // Central India / Nagpur
    {
      type: "Feature",
      properties: { tier: "blue" },
      geometry: {
        type: "Polygon",
        coordinates: [[[76.2, 23.8], [81.5, 23.6], [82.0, 21.2], [79.2, 20.8], [76.8, 21.5], [76.2, 23.8]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "cyan" },
      geometry: {
        type: "Polygon",
        coordinates: [[[77.0, 23.2], [80.8, 23.0], [81.2, 21.6], [78.8, 21.2], [77.4, 21.8], [77.0, 23.2]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "green" },
      geometry: {
        type: "Polygon",
        coordinates: [[[77.8, 22.8], [80.2, 22.6], [80.6, 21.8], [78.4, 21.5], [77.8, 22.8]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "yellow" },
      geometry: {
        type: "Polygon",
        coordinates: [[[78.4, 22.4], [79.6, 22.3], [79.8, 21.9], [78.8, 21.8], [78.4, 22.4]]]
      }
    },
    // Bay of Bengal Vortex
    {
      type: "Feature",
      properties: { tier: "blue" },
      geometry: {
        type: "Polygon",
        coordinates: [[[84.5, 20.5], [89.2, 19.8], [89.8, 16.5], [86.8, 15.2], [83.8, 17.2], [84.5, 20.5]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "cyan" },
      geometry: {
        type: "Polygon",
        coordinates: [[[85.2, 19.8], [88.5, 19.2], [89.0, 17.0], [86.2, 16.0], [84.5, 17.8], [85.2, 19.8]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "green" },
      geometry: {
        type: "Polygon",
        coordinates: [[[85.8, 19.2], [87.8, 18.8], [88.2, 17.2], [85.8, 16.6], [85.0, 18.2], [85.8, 19.2]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "yellow" },
      geometry: {
        type: "Polygon",
        coordinates: [[[86.2, 18.8], [87.4, 18.4], [87.6, 17.5], [86.2, 17.0], [85.5, 18.0], [86.2, 18.8]]]
      }
    },
    {
      type: "Feature",
      properties: { tier: "red" },
      geometry: {
        type: "Polygon",
        coordinates: [[[86.5, 18.4], [87.0, 18.2], [87.1, 17.7], [86.3, 17.4], [86.5, 18.4]]]
      }
    }
  ]
};

// Lightning Strikes
const LIGHTNING_STRIKES = [
  { lon: 86.8, lat: 17.8 },
  { lon: 87.4, lat: 18.5 },
  { lon: 85.9, lat: 18.0 },
  { lon: 91.2, lat: 23.6 },
  { lon: 92.0, lat: 24.1 },
  { lon: 89.8, lat: 22.4 },
  { lon: 80.2, lat: 26.8 },
  { lon: 81.5, lat: 26.2 },
  { lon: 77.2, lat: 28.8 },
  { lon: 66.8, lat: 24.2 },
  { lon: 73.8, lat: 16.5 },
  { lon: 83.6, lat: 16.8 }
];

// MapLibre Base Styles
const MAPLIBRE_COMBINED_STYLE = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "&copy; Esri, Earthstar Geographics"
    },
    "esri-satellite-ref": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256
    },
    "esri-dark-gray-base": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256
    },
    "esri-dark-gray-ref": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256
    }
  },
  layers: [
    {
      id: "satellite-layer",
      type: "raster",
      source: "esri-satellite",
      paint: { "raster-fade-duration": 0, "raster-resampling": "linear" }
    },
    {
      id: "radar-dark-base-layer",
      type: "raster",
      source: "esri-dark-gray-base",
      layout: { visibility: "none" },
      paint: { "raster-fade-duration": 0, "raster-resampling": "linear" }
    },
    {
      id: "satellite-ref-layer",
      type: "raster",
      source: "esri-satellite-ref",
      paint: { "raster-opacity": 0.92, "raster-fade-duration": 0 }
    }
  ]
};

export default function WindyMap({
  stations = STATIONS_DATA,
  activeStationKey = "dehradun",
  onSelectStationKey,
  activeLayer = "wind",
  showParticles = true,
  showStations = true,
  timeIndex = 3,
  mapActionRef
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const canvasRef = useRef(null);
  const windHeatmapCanvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // High performance typed array buffers for particle simulation (2400 particles for Ventusky-density)
  const particleCount = 2400;
  const pX = useRef(new Float32Array(particleCount));
  const pY = useRef(new Float32Array(particleCount));
  const pAge = useRef(new Uint16Array(particleCount));
  const pMaxAge = useRef(new Uint16Array(particleCount));
  const pSpeed = useRef(new Float32Array(particleCount));
  const pWindMag = useRef(new Float32Array(particleCount)); // wind magnitude for colour coding

  const [lastUpdateTime, setLastUpdateTime] = useState("Just now (09:58 AM)");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [is3DActive, setIs3DActive] = useState(false);
  const [radarTimestampPath, setRadarTimestampPath] = useState(null);

  // Particle controls (internal to map, exposed via floating overlay)
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [particleSpeedMult, setParticleSpeedMult] = useState(1.0); // 0.25 – 3.0

  // Direct DOM text refs for 120 FPS HUD updates
  const coordTextRef = useRef(null);
  const elevTextRef = useRef(null);

  const activeStation = stations[activeStationKey] || stations.dehradun;

  // Fetch real-time live Doppler Radar timestamp from RainViewer Public API
  useEffect(() => {
    let isMounted = true;
    fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const past = data?.radar?.past;
        if (past && past.length > 0) {
          const latest = past[past.length - 1];
          setRadarTimestampPath(latest.path);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Helper: Apply Layer Visibility
  const applyLayerVisibility = (map, layer) => {
    if (!map || !map.isStyleLoaded()) return;

    const isRadar = layer === "radar";
    const isWind = layer === "wind";

    // 1. Basemap switching
    if (map.getLayer("satellite-layer")) {
      map.setLayoutProperty("satellite-layer", "visibility", isRadar ? "none" : "visible");
      if (isWind) {
        map.setPaintProperty("satellite-layer", "raster-brightness-max", 0.55);
        map.setPaintProperty("satellite-layer", "raster-contrast", 0.2);
      } else {
        map.setPaintProperty("satellite-layer", "raster-brightness-max", 1.0);
        map.setPaintProperty("satellite-layer", "raster-contrast", 0.0);
      }
    }

    if (map.getLayer("radar-dark-base-layer")) {
      map.setLayoutProperty("radar-dark-base-layer", "visibility", isRadar ? "visible" : "none");
    }
    if (map.getLayer("radar-dark-ref-layer")) {
      map.setLayoutProperty("radar-dark-ref-layer", "visibility", isRadar ? "visible" : "none");
    }

    // 2. Radar Coverage Footprint Disks
    if (map.getLayer("radar-disks-fill")) {
      map.setLayoutProperty("radar-disks-fill", "visibility", isRadar ? "visible" : "none");
    }
    if (map.getLayer("radar-disks-stroke")) {
      map.setLayoutProperty("radar-disks-stroke", "visibility", isRadar ? "visible" : "none");
    }

    // 3. Radar Reflectivity Multi-Tier Echoes
    ["radar-echo-blue", "radar-echo-cyan", "radar-echo-green", "radar-echo-yellow", "radar-echo-red"].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", isRadar ? "visible" : "none");
      }
    });

    // 4. Live RainViewer Raster Tile Layer
    if (map.getLayer("doppler-radar-layer")) {
      map.setLayoutProperty("doppler-radar-layer", "visibility", isRadar ? "visible" : "none");
    }
  };

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAPLIBRE_COMBINED_STYLE,
      center: [78.0, 23.5],
      zoom: 4.8,
      minZoom: 3,
      maxZoom: 18,
      pitch: 0,
      bearing: 0,
      maxPitch: 75,
      antialias: true,
      fadeDuration: 0,
      maxTileCacheSize: 1000,
      trackResize: true,
      renderWorldCopies: false,
      crossSourceCollisions: false,
    });

    mapRef.current = map;

    if (map.setPrefetchZoomDelta) {
      map.setPrefetchZoomDelta(2);
    }

    map.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: "metric" }), "bottom-right");

    map.on("load", () => {
      // 1. Radar Coverage Footprints
      map.addSource("radar-disks-source", {
        type: "geojson",
        data: RADAR_COVERAGE_DISKS_GEOJSON
      });

      map.addLayer({
        id: "radar-disks-fill",
        type: "fill",
        source: "radar-disks-source",
        layout: { visibility: "none" },
        paint: { "fill-color": "#ffffff", "fill-opacity": 0.08 }
      });

      map.addLayer({
        id: "radar-disks-stroke",
        type: "line",
        source: "radar-disks-source",
        layout: { visibility: "none" },
        paint: { "line-color": "rgba(255, 255, 255, 0.16)", "line-width": 1 }
      });

      // 2. High-Definition Radar Echoes
      map.addSource("radar-echoes-source", {
        type: "geojson",
        data: RADAR_REFLECTIVITY_ECHOES_GEOJSON
      });

      map.addLayer({
        id: "radar-echo-blue",
        type: "fill",
        source: "radar-echoes-source",
        filter: ["==", "tier", "blue"],
        layout: { visibility: "none" },
        paint: { "fill-color": "#2563eb", "fill-opacity": 0.75 }
      });
      map.addLayer({
        id: "radar-echo-cyan",
        type: "fill",
        source: "radar-echoes-source",
        filter: ["==", "tier", "cyan"],
        layout: { visibility: "none" },
        paint: { "fill-color": "#06b6d4", "fill-opacity": 0.88 }
      });
      map.addLayer({
        id: "radar-echo-green",
        type: "fill",
        source: "radar-echoes-source",
        filter: ["==", "tier", "green"],
        layout: { visibility: "none" },
        paint: { "fill-color": "#10b981", "fill-opacity": 0.95 }
      });
      map.addLayer({
        id: "radar-echo-yellow",
        type: "fill",
        source: "radar-echoes-source",
        filter: ["==", "tier", "yellow"],
        layout: { visibility: "none" },
        paint: { "fill-color": "#facc15", "fill-opacity": 1.0 }
      });
      map.addLayer({
        id: "radar-echo-red",
        type: "fill",
        source: "radar-echoes-source",
        filter: ["==", "tier", "red"],
        layout: { visibility: "none" },
        paint: { "fill-color": "#ef4444", "fill-opacity": 1.0 }
      });

      // 3. Dark Gray Reference Labels
      map.addLayer({
        id: "radar-dark-ref-layer",
        type: "raster",
        source: "esri-dark-gray-ref",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.95, "raster-fade-duration": 0 }
      });

      // Apply Initial Layer Visibility
      applyLayerVisibility(map, activeLayer);
    });

    // Zero-ReRender Direct DOM Mousemove Listener
    map.on("mousemove", (e) => {
      if (coordTextRef.current) {
        const lat = e.lngLat.lat;
        const lon = e.lngLat.lng;
        const latStr = lat > 0 ? `${lat.toFixed(4)}°N` : `${(-lat).toFixed(4)}°S`;
        const lonStr = lon > 0 ? `${lon.toFixed(4)}°E` : `${(-lon).toFixed(4)}°W`;
        coordTextRef.current.innerText = `${latStr}, ${lonStr}`;
      }
      if (elevTextRef.current) {
        const latFactor = Math.max(0, (e.lngLat.lat - 20.0) * 400);
        const lonFactor = Math.max(0, (e.lngLat.lng - 70.0) * 150);
        const approxElev = Math.max(120, Math.round(latFactor + lonFactor));
        elevTextRef.current.innerText = `${approxElev} m`;
      }
    });

    // Map Click for Spot Weather
    map.on("click", (e) => {
      const spot = computeSpotWeather(e.lngLat.lat, e.lngLat.lng, timeIndex);
      
      new maplibregl.Popup({ offset: 15, closeButton: true })
        .setLngLat([e.lngLat.lng, e.lngLat.lat])
        .setHTML(`
          <div class="p-1 flex flex-col gap-1.5 font-mono text-xs">
            <div class="flex items-center justify-between border-b border-white/15 pb-1">
              <span class="font-bold text-cyan-400">Target Coordinates</span>
              <span class="text-[10px] text-slate-400">${e.lngLat.lat.toFixed(2)}°, ${e.lngLat.lng.toFixed(2)}°</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div><span class="text-slate-400 font-sans">Temp:</span> <strong class="text-white">${spot.temp}°C</strong></div>
              <div><span class="text-slate-400 font-sans">Rain:</span> <strong class="text-cyan-300">${spot.rainRate} mm/h</strong></div>
              <div><span class="text-slate-400 font-sans">Pressure:</span> <strong class="text-amber-300">${spot.pressure} hPa</strong></div>
              <div><span class="text-slate-400 font-sans">Wind:</span> <strong class="text-emerald-300">${spot.windSpeed || 18} kt</strong></div>
            </div>
          </div>
        `)
        .addTo(map);
    });

    // Connect external zoom and 3D handlers
    if (mapActionRef) {
      mapActionRef.current = {
        zoomIn: () => map.zoomIn({ duration: 300 }),
        zoomOut: () => map.zoomOut({ duration: 300 }),
        toggle3D: () => {
          setIs3DActive((prev) => {
            const next3D = !prev;
            map.easeTo({
              pitch: next3D ? 52 : 0,
              bearing: next3D ? -16 : 0,
              duration: 900
            });
            return next3D;
          });
        }
      };
    }

    return () => {
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamically Toggle Layer Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyLayerVisibility(map, activeLayer);
  }, [activeLayer]);

  // Update Radar Source when timestamp resolves
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !radarTimestampPath) return;

    if (!map.getSource("doppler-radar-source")) {
      map.addSource("doppler-radar-source", {
        type: "raster",
        tiles: [
          `https://tilecache.rainviewer.com${radarTimestampPath}/256/{z}/{x}/{y}/8/1_1.png`
        ],
        tileSize: 256
      });

      map.addLayer({
        id: "doppler-radar-layer",
        type: "raster",
        source: "doppler-radar-source",
        layout: {
          visibility: activeLayer === "radar" ? "visible" : "none"
        },
        paint: {
          "raster-opacity": 0.85,
          "raster-fade-duration": 0,
          "raster-resampling": "linear"
        }
      });
    }
  }, [radarTimestampPath, activeLayer]);

  // Handle station flyTo with buttery easing
  useEffect(() => {
    if (!mapRef.current || !activeStation) return;
    mapRef.current.flyTo({
      center: [activeStation.coordinates[1], activeStation.coordinates[0]],
      zoom: 6.2,
      duration: 1100,
      essential: true
    });
  }, [activeStationKey, activeStation]);

  // Render HTML Markers (Wind City Labels in Wind Mode, Lightning in Radar Mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. Wind & Temperature Labels (Exact match to Reference Screenshot)
    if (activeLayer === "wind" || activeLayer === "temp") {
      WIND_MAP_CITIES.forEach((city) => {
        const el = document.createElement("div");
        el.className = "custom-wind-city-label pointer-events-none select-none flex flex-col items-center -translate-x-1/2 -translate-y-1/2 text-center";
        el.innerHTML = `
          <span class="text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] tracking-tight leading-tight">
            ${city.name}
          </span>
          <span class="text-[10px] font-bold text-slate-200/90 font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] leading-tight">
            ${city.temp}°
          </span>
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([city.lon, city.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
      return;
    }

    // 2. Lightning Strikes in Radar Mode
    if (activeLayer === "radar") {
      LIGHTNING_STRIKES.forEach((ls) => {
        const el = document.createElement("div");
        el.className = "custom-lightning-strike pointer-events-none select-none flex items-center justify-center -translate-x-1/2 -translate-y-1/2 animate-pulse";
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="w-3.5 h-3.5 rounded-full bg-fuchsia-500/40 blur-xs absolute"></span>
            <svg class="w-4 h-4 text-fuchsia-300 drop-shadow-[0_0_6px_#e879f9]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([ls.lon, ls.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    if (!showStations) return;

    // 3. Station Markers in Default/Other Views
    Object.values(stations).forEach((station) => {
      const isSelected = activeStationKey === station.key;
      const isHigh = station.riskLevel === "HIGH";
      const isModerate = station.riskLevel === "MODERATE";
      const dotColor = isHigh ? "bg-amber-400" : isModerate ? "bg-yellow-400" : "bg-cyan-400";
      const temp = station.primaryMetrics?.temperature?.value ?? "--";
      const windDeg = station.primaryMetrics?.windDirection?.deg || 0;

      const el = document.createElement("div");
      el.className = "custom-station-marker cursor-pointer select-none transition-transform hover:scale-110 active:scale-95";
      el.innerHTML = `
        <div class="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 border ${
          isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/30' : 'border-white/20'
        } shadow-2xl backdrop-blur-xl">
          <span class="w-2 h-2 rounded-full ${dotColor}"></span>
          <span class="text-xs font-bold text-white font-mono leading-none">${temp}°</span>
          <div style="transform: rotate(${windDeg}deg);" class="transition-transform duration-500">
            <svg class="w-3 h-3 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectStationKey(station.key);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.coordinates[1], station.coordinates[0]])
        .addTo(map);

      markersRef.current.push(marker);
    });

  }, [stations, activeStationKey, showStations, onSelectStationKey, activeLayer]);

  // Atmospheric Wind Velocity Heatmap Layer (Matching Reference Gradient)
  useEffect(() => {
    const canvas = windHeatmapCanvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext("2d");

    const renderHeatmap = () => {
      if (activeLayer !== "wind") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const rect = map.getCanvas().getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Multi-stop Atmospheric Wind Gradient Mesh (Matching Reference Image)
      const gradient = ctx.createLinearGradient(0, canvas.height, canvas.width, 0);
      gradient.addColorStop(0.0, "rgba(101, 163, 13, 0.72)");   // Lime Green over Arabian Sea
      gradient.addColorStop(0.25, "rgba(5, 150, 105, 0.70)");  // Emerald/Teal coastal belt
      gradient.addColorStop(0.50, "rgba(13, 148, 136, 0.65)"); // Teal over Central India
      gradient.addColorStop(0.72, "rgba(30, 58, 138, 0.70)");  // Deep Blue over Gangetic plain
      gradient.addColorStop(0.90, "rgba(49, 46, 129, 0.82)");  // Deep Indigo/Violet over Himalayas
      gradient.addColorStop(1.0, "rgba(88, 28, 135, 0.85)");   // Violet over Tibetan Plateau

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Localized Strong Wind Hotspots (Arabian Sea & Bay of Bengal Convection)
      const pArabian = map.project([67.5, 19.5]);
      const radArabian = ctx.createRadialGradient(pArabian.x, pArabian.y, 10, pArabian.x, pArabian.y, 320);
      radArabian.addColorStop(0, "rgba(132, 204, 22, 0.8)");
      radArabian.addColorStop(0.6, "rgba(34, 197, 94, 0.5)");
      radArabian.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radArabian;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const pBay = map.project([87.0, 18.0]);
      const radBay = ctx.createRadialGradient(pBay.x, pBay.y, 10, pBay.x, pBay.y, 300);
      radBay.addColorStop(0, "rgba(132, 204, 22, 0.75)");
      radBay.addColorStop(0.6, "rgba(13, 148, 136, 0.45)");
      radBay.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radBay;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    renderHeatmap();
    map.on("move", renderHeatmap);
    map.on("resize", renderHeatmap);

    return () => {
      map.off("move", renderHeatmap);
      map.off("resize", renderHeatmap);
    };
  }, [activeLayer]);

  // ── Ventusky-style Animated Wind Particle Engine ──────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext("2d", { alpha: true });

    // Map wind magnitude (knots equiv.) → Ventusky colour palette
    // indigo(calm) → cyan → lime → yellow → orange → red(gale)
    const windColour = (mag, alpha) => {
      // mag: 0-40+ (arbitrary units from u/v)
      const t = Math.min(mag / 14, 1); // normalise 0-1 at ~14 u/v units
      let r, g, b;
      if (t < 0.20) {          // indigo → deep blue
        const s = t / 0.20;
        r = Math.round(99  + s * (30  - 99));   // 99→30
        g = Math.round(102 + s * (144 - 102));  // 102→144
        b = Math.round(241 + s * (255 - 241));  // 241→255
      } else if (t < 0.40) {  // blue → cyan
        const s = (t - 0.20) / 0.20;
        r = Math.round(30  + s * (6   - 30));
        g = Math.round(144 + s * (182 - 144));
        b = Math.round(255 + s * (212 - 255));
      } else if (t < 0.60) {  // cyan → lime green
        const s = (t - 0.40) / 0.20;
        r = Math.round(6   + s * (132 - 6));
        g = Math.round(182 + s * (204 - 182));
        b = Math.round(212 + s * (22  - 212));
      } else if (t < 0.78) {  // lime → yellow
        const s = (t - 0.60) / 0.18;
        r = Math.round(132 + s * (250 - 132));
        g = Math.round(204 + s * (204 - 204));
        b = Math.round(22  + s * (20  - 22));
      } else if (t < 0.90) {  // yellow → orange
        const s = (t - 0.78) / 0.12;
        r = Math.round(250 + s * (249 - 250));
        g = Math.round(204 + s * (115 - 204));
        b = Math.round(20  + s * (22  - 20));
      } else {                 // orange → red
        const s = (t - 0.90) / 0.10;
        r = Math.round(249 + s * (239 - 249));
        g = Math.round(115 + s * (68  - 115));
        b = Math.round(22  + s * (68  - 22));
      }
      return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    };

    const resizeCanvas = () => {
      const rect = map.getCanvas().getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      for (let i = 0; i < particleCount; i++) {
        pX.current[i] = Math.random() * canvas.width;
        pY.current[i] = Math.random() * canvas.height;
        pAge.current[i] = Math.floor(Math.random() * 90);
        pMaxAge.current[i] = 70 + Math.floor(Math.random() * 60);
        pSpeed.current[i] = 0.9 + Math.random() * 1.4;
        pWindMag.current[i] = 0;
      }
    };

    resizeCanvas();
    map.on("resize", resizeCanvas);

    // Realistic Southwest Monsoon wind vector field
    const getWindVector = (px, py) => {
      const lngLat = map.unproject([px, py]);
      const lat = lngLat.lat;
      const lon = lngLat.lng;

      // Base SW monsoon flow (eastward + slight northward)
      let u = 1.6 + Math.sin(lat * 0.11 + timeIndex * 0.18) * 0.9
                  + Math.cos(lon * 0.07 + timeIndex * 0.12) * 0.5;
      let v = -0.7 + Math.cos(lat * 0.09 + timeIndex * 0.15) * 0.6
                   + Math.sin(lon * 0.06)                    * 0.3;

      // Arabian Sea LLJ – strong westerly jet
      if (lat > 10 && lat < 25 && lon > 55 && lon < 75) {
        u += 3.5 + Math.sin(lat * 0.3) * 1.2;
        v -= 0.8;
      }
      // Bay of Bengal convergence zone
      if (lat > 14 && lat < 24 && lon > 84 && lon < 96) {
        u += 1.8;
        v += 1.4;
      }
      // Gangetic Plains monsoon trough
      if (lat > 24 && lat < 30 && lon > 74 && lon < 88) {
        u += 2.0 + Math.sin(timeIndex * 0.3) * 0.6;
        v -= 0.5;
      }
      // Himalayan orographic blocking (slows & deflects)
      if (lat > 28 && lon > 72 && lon < 96) {
        u *= 0.55;
        v += 0.9;
      }
      // Western Rajasthan hot-dry flow
      if (lat > 24 && lat < 30 && lon > 68 && lon < 76) {
        u += 1.2;
        v += 0.6;
      }

      const mag = Math.sqrt(u * u + v * v);
      return { u, v, mag };
    };

    let frameId;
    const render = () => {
      // Trail fade — destination-out creates smooth ghost trails
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";

      const shouldDraw = particlesEnabled && (showParticles || activeLayer === "wind");

      if (shouldDraw) {
        const xArr     = pX.current;
        const yArr     = pY.current;
        const ageArr   = pAge.current;
        const maxAArr  = pMaxAge.current;
        const spdArr   = pSpeed.current;
        const magArr   = pWindMag.current;
        const spd      = particleSpeedMult;

        for (let i = 0; i < particleCount; i++) {
          const oldX = xArr[i];
          const oldY = yArr[i];
          const { u, v, mag } = getWindVector(oldX, oldY);

          // Smooth speed: blend stored mag with current
          magArr[i] = magArr[i] * 0.85 + mag * 0.15;

          const step  = spdArr[i] * spd * 1.3;
          const newX  = oldX + u * step;
          const newY  = oldY - v * step;
          xArr[i]  = newX;
          yArr[i]  = newY;
          ageArr[i]++;

          // Bell-curve life alpha
          const lifeT = ageArr[i] / maxAArr[i];
          const alpha = Math.sin(lifeT * Math.PI);

          if (alpha > 0.06) {
            const colour = windColour(magArr[i], alpha * 0.82);
            const lineW  = 1.2 + (magArr[i] / 14) * 0.8; // thicker at high speed

            ctx.beginPath();
            ctx.lineWidth   = lineW;
            ctx.lineCap     = "round";
            ctx.strokeStyle = colour;
            ctx.moveTo(oldX, oldY);
            ctx.lineTo(newX, newY);
            ctx.stroke();
          }

          // Respawn when out-of-bounds or aged out
          if (
            newX < -4 || newX > canvas.width  + 4 ||
            newY < -4 || newY > canvas.height + 4 ||
            ageArr[i] >= maxAArr[i]
          ) {
            xArr[i]    = Math.random() * canvas.width;
            yArr[i]    = Math.random() * canvas.height;
            ageArr[i]  = 0;
            maxAArr[i] = 70 + Math.floor(Math.random() * 60);
            spdArr[i]  = 0.9 + Math.random() * 1.4;
          }
        }
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    animFrameRef.current = { cancel: () => cancelAnimationFrame(frameId) };

    const onMove = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); };
    map.on("move", onMove);

    return () => {
      cancelAnimationFrame(frameId);
      map.off("resize", resizeCanvas);
      map.off("move", onMove);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showParticles, activeLayer, timeIndex, particlesEnabled, particleSpeedMult]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastUpdateTime(`Just now (${timeStr})`);
      setIsRefreshing(false);
    }, 400);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#070e1b]">
      {/* MapLibre GL WebGL Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Atmospheric Wind Velocity Gradient Layer (Visible in Wind Mode) */}
      <canvas
        ref={windHeatmapCanvasRef}
        className={`pointer-events-none absolute inset-0 z-[5] h-full w-full will-change-transform mix-blend-screen transition-opacity duration-500 ${
          activeLayer === "wind" ? "opacity-90" : "opacity-0"
        }`}
      />

      {/* Synchronized Ventusky-Style Streamline Particle Canvas – always mounted, hidden when off */}
      <canvas
        ref={canvasRef}
        className={`pointer-events-none absolute inset-0 z-[10] h-full w-full will-change-transform transition-opacity duration-500 ${
          particlesEnabled && (showParticles || activeLayer === "wind") ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* ── Floating Wind Particle Controls ─────────────────────────────────── */}
      <div className="absolute left-3 top-3 z-30 pointer-events-auto select-none flex flex-col gap-1.5">
        {/* Enable / Disable Toggle */}
        <div className="windy-glass rounded-2xl px-3 py-2.5 border border-white/20 shadow-2xl backdrop-blur-2xl flex flex-col gap-2 min-w-[188px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-bold text-slate-100 tracking-wide uppercase">Wind Particles</span>
            </div>
            {/* Toggle pill */}
            <button
              id="wind-particle-toggle"
              onClick={() => setParticlesEnabled(p => !p)}
              title={particlesEnabled ? "Disable wind particles" : "Enable wind particles"}
              className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none ${
                particlesEnabled
                  ? "bg-gradient-to-r from-cyan-500 to-teal-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                  : "bg-slate-700/80"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                  particlesEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Speed Slider – only visible when enabled */}
          <div className={`flex flex-col gap-1.5 transition-all duration-300 ${
            particlesEnabled ? "opacity-100 max-h-20" : "opacity-40 pointer-events-none max-h-20"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Speed</span>
              <span className="text-[10px] font-bold text-cyan-300 font-mono">{particleSpeedMult.toFixed(2)}×</span>
            </div>
            <input
              id="wind-particle-speed"
              type="range"
              min="0.25"
              max="3.0"
              step="0.05"
              value={particleSpeedMult}
              onChange={(e) => setParticleSpeedMult(parseFloat(e.target.value))}
              className="w-full h-1.5 accent-cyan-400 rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #22d3ee ${((particleSpeedMult - 0.25) / 2.75) * 100}%, #334155 0%)`
              }}
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>Slow</span>
              <span>Fast</span>
            </div>
          </div>

          {/* Colour scale legend (Ventusky style) */}
          {particlesEnabled && (
            <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Wind Speed</span>
              <div className="h-2 w-full rounded-full" style={{
                background: "linear-gradient(to right, #6366f1, #06b6d4, #84cc16, #facc14, #f97316, #ef4444)"
              }} />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>Calm</span>
                <span>Gale</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== DYNAMIC MASTER / WIND / RADAR LEGEND (Bottom-Left) ==================== */}
      <div className="absolute left-3 bottom-24 z-20 pointer-events-auto flex flex-col gap-1.5">
        <div className="windy-glass rounded-2xl p-2.5 shadow-2xl border border-white/20 min-w-[220px]">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-1.5">
            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              {activeLayer === "wind" ? (
                <>
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Wind Speed (kt)</span>
                </>
              ) : activeLayer === "radar" ? (
                <>
                  <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>Doppler Radar dBZ</span>
                </>
              ) : (
                <>
                  <Info className="w-3 h-3 text-cyan-400" />
                  <span>Convective Severity</span>
                </>
              )}
            </span>
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="text-[9px] text-slate-400 hover:text-white"
            >
              {showLegend ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Wind Speed Legend */}
          {showLegend && activeLayer === "wind" && (
            <div className="flex flex-col gap-1.5 text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-500 border border-yellow-300 shadow" />
                <span className="text-amber-200 font-sans font-medium">&gt; 30 kt • Strong Gale</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-lime-500 border border-lime-300 shadow" />
                <span className="text-lime-200 font-sans font-medium">20-30 kt • Fresh Breeze</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-teal-500 border border-teal-300 shadow" />
                <span className="text-teal-200 font-sans font-medium">10-20 kt • Moderate Wind</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-indigo-600 border border-blue-400 shadow" />
                <span className="text-indigo-200 font-sans font-medium">0-10 kt • Light Air / Calm</span>
              </div>
            </div>
          )}

          {/* Radar Legend */}
          {showLegend && activeLayer === "radar" && (
            <div className="flex flex-col gap-1.5 text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-500 border border-red-300 shadow" />
                <span className="text-red-200 font-sans font-medium">&gt; 50 dBZ • Heavy Storm</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-yellow-400 border border-yellow-200 shadow" />
                <span className="text-amber-200 font-sans font-medium">35-50 dBZ • Moderate Rain</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-300 shadow" />
                <span className="text-emerald-200 font-sans font-medium">20-35 dBZ • Light Showers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-600 border border-cyan-400 shadow" />
                <span className="text-cyan-200 font-sans font-medium">10-20 dBZ • Drizzle Halo</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-fuchsia-400 fill-fuchsia-300" />
                <span className="text-fuchsia-200 font-sans font-medium">Live Lightning Detected</span>
              </div>
            </div>
          )}

          {/* Default Satellite / Convective Legend */}
          {showLegend && activeLayer !== "wind" && activeLayer !== "radar" && (
            <div className="flex flex-col gap-1.5 text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-rose-600 border border-white shadow" />
                <span className="text-slate-200 font-sans font-medium">Severe Risk (&gt;55 dBZ)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-cyan-500 border border-cyan-300 shadow" />
                <span className="text-slate-300 font-sans font-medium">Convective Core</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-300/60 border border-white/40 shadow" />
                <span className="text-slate-400 font-sans font-medium">Vapor Canopy Veil</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== STREAMLINED STATUS BAR (Bottom-Left) ==================== */}
      <div className="absolute left-3 bottom-12 z-20 pointer-events-auto flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full windy-glass text-[11px] font-mono text-slate-200 shadow-2xl border border-white/20">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            <span>DATA STATUS: LIVE</span>
          </div>

          <div className="h-3 w-[1px] bg-white/20" />

          <span className="text-slate-300 text-[10px]">{lastUpdateTime}</span>

          <button
            onClick={handleManualRefresh}
            className={`p-1 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-all ${
              isRefreshing ? 'animate-spin text-cyan-400' : ''
            }`}
            title="Refresh Real-Time Data"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full windy-glass-pill text-[10px] font-mono text-slate-300 shadow-xl border border-white/15">
          <Navigation className="w-2.5 h-2.5 text-cyan-400" />
          <span ref={coordTextRef}>34.9266°N, 44.3357°E</span>
          <span className="text-slate-500">•</span>
          <span>Elev: <strong ref={elevTextRef} className="text-white font-bold">5971 m</strong></span>
        </div>
      </div>

      {/* ==================== MAP SCALE & LAYER BADGE (Bottom Right) ==================== */}
      <div className="absolute right-60 bottom-12 z-20 pointer-events-none hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full windy-glass-pill text-[10px] font-mono text-slate-200 shadow-2xl">
        {activeLayer === "wind" ? (
          <div className="flex items-center gap-1.5 text-slate-200">
            <Wind className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold tracking-tight">ECMWF Atmospheric Wind</span>
          </div>
        ) : activeLayer === "radar" ? (
          <div className="flex items-center gap-1.5 text-slate-300 font-sans">
            <Zap className="w-3.5 h-3.5 text-fuchsia-400 fill-fuchsia-400 animate-pulse" />
            <span className="font-bold text-white tracking-wide">nowcast</span>
            <span className="text-[9px] text-fuchsia-300/90 font-mono uppercase tracking-wider">LIGHTNING DETECTED</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold tracking-tight">
              {is3DActive ? "3D WebGL Perspective" : "Visible Satellite Imagery"}
            </span>
          </div>
        )}
        <div className="h-3 w-[1px] bg-white/20" />
        <div className="flex items-center gap-1 text-slate-300 text-[9px]">
          <span className="border-b-2 border-cyan-400 w-6 inline-block pb-0.5 text-center">500 km</span>
        </div>
      </div>
    </div>
  );
}