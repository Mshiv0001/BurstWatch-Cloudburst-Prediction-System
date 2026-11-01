/**
 * Authentic Convective Cloudburst Plume Generator for MapLibre GL JS Heatmap
 * Generates an organic, continuous convective stream centered directly on the active high-risk epicenter,
 * ensuring the danger pin and the storm gradient are 100% geographically unified.
 */

import { STATIONS_NETWORK } from '../data/cloudburstData';

/**
 * Generates an organic, multi-node convective storm cluster centered directly on [centerLon, centerLat]
 */
function generateEpicenterPlumeNodes(centerLon, centerLat, convectiveIntensity, baseWeight = 0.95) {
  const nodes = [];

  // Core eye / peak updraft at exact epicenter
  nodes.push({
    lon: centerLon,
    lat: centerLat,
    weight: Math.min(0.98, baseWeight * convectiveIntensity),
    name: "Convective Updraft Core"
  });

  const cosLat = Math.cos((centerLat * Math.PI) / 180.0) || 1.0;

  // Inner ring: 6 dense convective cells (radius ~7-10 km)
  const innerR = 0.075;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.35;
    const r = innerR * (0.85 + 0.3 * Math.sin(i * 2.2));
    nodes.push({
      lon: centerLon + (r / cosLat) * Math.cos(angle),
      lat: centerLat + r * Math.sin(angle),
      weight: Math.min(0.90, baseWeight * 0.82 * convectiveIntensity),
      name: `Core Updraft ${i + 1}`
    });
  }

  // Mid ring: 8 convective outflow cells (radius ~16-22 km)
  const midR = 0.17;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.6;
    const r = midR * (0.80 + 0.35 * Math.cos(i * 2.7));
    nodes.push({
      lon: centerLon + (r / cosLat) * Math.cos(angle),
      lat: centerLat + r * Math.sin(angle),
      weight: Math.min(0.75, baseWeight * 0.58 * convectiveIntensity),
      name: `Outflow Feeder ${i + 1}`
    });
  }

  // Outer ring: 8 anvil dissipation cells (radius ~28-36 km)
  const outerR = 0.28;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.15;
    const r = outerR * (0.85 + 0.3 * Math.sin(i * 1.8));
    nodes.push({
      lon: centerLon + (r / cosLat) * Math.cos(angle),
      lat: centerLat + r * Math.sin(angle),
      weight: Math.min(0.50, baseWeight * 0.35 * convectiveIntensity),
      name: `Anvil Boundary ${i + 1}`
    });
  }

  return nodes;
}

/**
 * Builds streamlined GeoJSON FeatureCollection for MapLibre GL built-in heatmap layer
 */
export function generateCloudburstHeatmapGeoJSON({
  stations = STATIONS_NETWORK,
  selectedStation = null,
  cloudburstEvent = null,
  threatData = null,
  humidity = 55,
  pressureDrop = 6
}) {
  const features = [];

  // Determine active epicenter coordinates [lon, lat]
  const epicenterCoords = cloudburstEvent?.coordinates || 
    (selectedStation?.lon != null && selectedStation?.lat != null ? [selectedStation.lon, selectedStation.lat] : null);

  // CRITICAL: Live ML Backend Prediction Risk ALWAYS takes priority over simulator threatData!
  const rawRisk = (cloudburstEvent?.isLive && cloudburstEvent?.metrics?.riskPercent != null)
    ? cloudburstEvent.metrics.riskPercent / 100
    : (threatData?.riskPercent != null ? threatData.riskPercent / 100 : 0.04);

  // If convective cloudburst risk is below 25% (normal/low risk), no hazard plume is drawn
  if (rawRisk < 0.25) {
    return {
      type: "FeatureCollection",
      features: []
    };
  }

  // Active Convective Storm Scaling (scales smoothly from 25% to 100% risk)
  const severityScale = Math.min(1.0, (rawRisk - 0.25) / 0.65);
  const humidityRatio = Math.max(0.5, Math.min(1.35, humidity / 85));
  const pressureRatio = Math.max(0.5, Math.min(1.35, pressureDrop / 28));
  const convectiveIntensity = severityScale * (humidityRatio * 0.5 + pressureRatio * 0.5);

  // 1. DYNAMIC EPICENTER CONVECTIVE PLUME:
  // Directly centers the 23-node storm cloud around the active warning pin!
  if (epicenterCoords) {
    const [centerLon, centerLat] = epicenterCoords;
    const plumeNodes = generateEpicenterPlumeNodes(centerLon, centerLat, convectiveIntensity, 0.95);
    
    plumeNodes.forEach((node, i) => {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [node.lon, node.lat]
        },
        properties: {
          id: `epicenter-plume-${i}`,
          name: node.name,
          weight: node.weight,
          isEpicenterPlume: true
        }
      });
    });
  }

  return {
    type: "FeatureCollection",
    features
  };
}
