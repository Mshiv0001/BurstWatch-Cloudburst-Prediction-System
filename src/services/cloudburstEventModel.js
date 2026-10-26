/**
 * Cloudburst Event Data Model & Backend ML Interface
 * 
 * NOTE FOR BACKEND & ML ENGINEER:
 * To integrate your live Python / FastAPI / Node.js ML model backend:
 * Simply replace `getMockCloudburstEvent()` with your API fetch endpoint:
 * const response = await fetch('http://your-backend:8000/api/cloudburst/current');
 * return await response.json();
 */

export const CLOUDBURST_PRESET_EVENTS = {
  kedarnath: {
    id: "CB-UK-2026-001",
    title: "Kedarnath Basin Convective Cloudburst",
    status: "CRITICAL", // "MONITORING" | "WARNING" | "CRITICAL" | "IMMINENT"
    locationName: "Kedarnath Catchment & Mandakini Basin",
    state: "Uttarakhand",
    coordinates: [79.0669, 30.7346], // [lon, lat]
    elevationMeters: 3584,
    detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    leadTimeMinutes: 38,
    mlModel: {
      name: "ConvLSTM + LightGBM Cloudburst Ensemble v2.4",
      confidencePercent: 96.4,
      riskLevel: "EXTREME_HAZARD"
    },
    metrics: {
      predictedRainRateMmh: 128.5, // Standard meteorological threshold: >= 100 mm/h
      capeJkg: 3850,              // Convective Available Potential Energy (Extreme > 2500)
      pressureDropHpa: 34.2,      // 3-hour surface pressure collapse
      echoTopKm: 15.2,            // Cumulonimbus radar echo top height
      tpwMm: 68.4,                // Total Precipitable Water column
      windGustKmh: 92             // Orographic downdraft velocity
    },
    affectedBasins: [
      "Mandakini Upper Valley",
      "Gaurikund Drainage",
      "Rudraprayag Confluence"
    ],
    hazardRadiusKm: 18,
    advisory: "IMMEDIATE EVACUATION: Flash flood & debris avalanche warning. Disengage all pilgrim transit routes along riverbanks."
  },
  dharamshala: {
    id: "CB-HP-2026-002",
    title: "Dharamshala Orographic Cloudburst",
    status: "IMMINENT",
    locationName: "Dharamshala Ridge & Kangra Gorge",
    state: "Himachal Pradesh",
    coordinates: [76.3234, 32.2190],
    elevationMeters: 1457,
    detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    leadTimeMinutes: 45,
    mlModel: {
      name: "ConvLSTM + LightGBM Cloudburst Ensemble v2.4",
      confidencePercent: 91.8,
      riskLevel: "HIGH_HAZARD"
    },
    metrics: {
      predictedRainRateMmh: 112.0,
      capeJkg: 3200,
      pressureDropHpa: 28.5,
      echoTopKm: 13.8,
      tpwMm: 62.0,
      windGustKmh: 84
    },
    affectedBasins: [
      "Bhagsunag Stream",
      "Manjhi Khad",
      "Kangra Valley"
    ],
    hazardRadiusKm: 14,
    advisory: "HIGH RISK: Rapid surface runoff and debris torrents expected within 45 minutes. Avoid low bridges and drainage corridors."
  }
};

/**
 * Generates an evacuation hazard radius GeoJSON circle for MapLibre map rendering
 */
export function generateHazardRadiusGeoJSON(centerLon, centerLat, radiusKm = 18, points = 64) {
  const coords = [];
  const distanceX = radiusKm / (111.320 * Math.cos((centerLat * Math.PI) / 180));
  const distanceY = radiusKm / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([centerLon + x, centerLat + y]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { radiusKm },
        geometry: {
          type: "Polygon",
          coordinates: [coords]
        }
      }
    ]
  };
}

/**
 * Helper to fetch live model predictions from backend API with fallback to presets
 * 
 * BACKEND & ML ENGINEER INSTRUCTIONS:
 * Connect your FastAPI / Flask / Express backend here or send JSON in this format:
 * GET /api/cloudburst/live -> { id, status, locationName, coordinates: [lon, lat], metrics: {...}, mlModel: {...}, affectedBasins: [...], hazardRadiusKm, advisory }
 */
export async function getCloudburstEventData(endpointUrl = '/api/cloudburst/live', fallbackPreset = 'kedarnath') {
  try {
    const res = await fetch(endpointUrl);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    // Backend API not connected yet — return active preset scenario
  }
  return CLOUDBURST_PRESET_EVENTS[fallbackPreset] || CLOUDBURST_PRESET_EVENTS.kedarnath;
}
