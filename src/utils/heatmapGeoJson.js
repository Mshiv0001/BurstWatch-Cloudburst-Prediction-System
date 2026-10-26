/**
 * Authentic Convective Cloudburst Plume Generator for MapLibre GL JS Heatmap
 * Generates an organic, continuous convective stream along the Himalayan mountain front
 * and active network stations, eliminating artificial grid polka-dots and clipping blobs.
 */

import { STATIONS_NETWORK } from '../data/cloudburstData';

// Continuous Himalayan Convective Cloudburst Corridor (Natural valley funnel chain)
// Running along the Himalayan front range where moist monsoonal air funnels into steep gorges
const HIMALAYAN_CORRIDOR_NODES = [
  // Jammu & Kashmir Front & Valleys
  { lon: 74.80, lat: 34.08, baseWeight: 0.42, name: "Srinagar Basin" },
  { lon: 75.18, lat: 33.95, baseWeight: 0.48, name: "Anantnag Corridor" },
  { lon: 75.52, lat: 34.22, baseWeight: 0.58, name: "Amarnath Baltal Valley" },
  { lon: 75.76, lat: 33.32, baseWeight: 0.52, name: "Kishtwar Gorge" },
  { lon: 76.10, lat: 33.05, baseWeight: 0.48, name: "Padder Valley" },

  // Himachal Pradesh Convective Stream
  { lon: 76.32, lat: 32.22, baseWeight: 0.60, name: "Dharamshala Uplift" },
  { lon: 76.75, lat: 32.10, baseWeight: 0.56, name: "Palampur Slopes" },
  { lon: 76.95, lat: 31.72, baseWeight: 0.54, name: "Mandi Beas Basin" },
  { lon: 77.12, lat: 31.96, baseWeight: 0.64, name: "Kullu Valley" },
  { lon: 77.20, lat: 32.25, baseWeight: 0.68, name: "Manali Convergence" },
  { lon: 77.40, lat: 31.55, baseWeight: 0.58, name: "Rampur Bushahr" },
  { lon: 77.70, lat: 31.35, baseWeight: 0.60, name: "Rohru Valley" },

  // Uttarakhand Convective Ground-Zero Plume (Kedarnath - Chamoli - Dehradun Corridor)
  { lon: 78.05, lat: 30.32, baseWeight: 0.65, name: "Dehradun Foothills" },
  { lon: 78.18, lat: 30.46, baseWeight: 0.68, name: "Mussoorie Ridge" },
  { lon: 78.44, lat: 30.73, baseWeight: 0.70, name: "Uttarkashi Bhagirathi Valley" },
  { lon: 78.75, lat: 30.45, baseWeight: 0.72, name: "Tehri Catchment" },
  { lon: 78.98, lat: 30.28, baseWeight: 0.74, name: "Rudraprayag Confluence" },
  { lon: 79.07, lat: 30.73, baseWeight: 0.82, name: "Kedarnath Temple Basin" },
  { lon: 79.25, lat: 30.60, baseWeight: 0.76, name: "Tungnath Ridge" },
  { lon: 79.57, lat: 30.56, baseWeight: 0.78, name: "Chamoli Joshimath Funnel" },
  { lon: 79.50, lat: 30.74, baseWeight: 0.75, name: "Badrinath Pass" },
  { lon: 79.75, lat: 30.30, baseWeight: 0.70, name: "Karanprayag Valley" },
  { lon: 79.45, lat: 29.39, baseWeight: 0.58, name: "Nainital Kumaon Lakes" },
  { lon: 79.95, lat: 29.85, baseWeight: 0.62, name: "Bageshwar Valley" },
  { lon: 80.22, lat: 29.58, baseWeight: 0.60, name: "Pithoragarh Kali Gorge" },
  { lon: 80.55, lat: 29.90, baseWeight: 0.64, name: "Dharchula Trans-Himalayan Gate" }
];

/**
 * Builds streamlined GeoJSON FeatureCollection for MapLibre GL built-in heatmap layer
 */
export function generateCloudburstHeatmapGeoJSON({
  stations = STATIONS_NETWORK,
  selectedStation = null,
  threatData = null,
  humidity = 90,
  pressureDrop = 30
}) {
  const features = [];

  // Realistic atmospheric convective scaling with guaranteed visible baseline
  const rawRisk = threatData?.riskPercent ? threatData.riskPercent / 100 : 0.75;
  const simRisk = Math.max(0.60, rawRisk);
  const humidityRatio = Math.max(0.5, Math.min(1.25, humidity / 85));
  const pressureRatio = Math.max(0.5, Math.min(1.25, pressureDrop / 28));
  const convectiveIntensity = Math.min(1.15, (humidityRatio * 0.55 + pressureRatio * 0.45) * simRisk);

  // 1. Himalayan Convective Corridor (Organic, continuous cloudburst plume along mountain arc)
  HIMALAYAN_CORRIDOR_NODES.forEach((node, i) => {
    const weight = Math.max(0.20, Math.min(0.85, node.baseWeight * convectiveIntensity));

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [node.lon, node.lat]
      },
      properties: {
        id: `himalaya-corridor-${i}`,
        name: node.name,
        weight,
        isPlume: true
      }
    });
  });

  // 2. Monitored Network Stations (Elevated threat stations or explicitly selected station)
  stations.forEach((stn) => {
    const isSelected = selectedStation?.id === stn.id;
    const baseRisk = (stn.riskScore || 40) / 100;

    // Include stations that have elevated convective threat (>45) or are explicitly selected
    if (baseRisk > 0.45 || isSelected) {
      let weight = Math.max(0.20, Math.min(0.80, baseRisk * convectiveIntensity * 0.9));
      if (isSelected) {
        weight = Math.min(0.90, weight * 1.3);
      }

      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [stn.lon, stn.lat]
        },
        properties: {
          id: `station-node-${stn.id}`,
          name: stn.name,
          weight,
          isStation: true,
          isSelected
        }
      });
    }
  });

  return {
    type: "FeatureCollection",
    features
  };
}
