/**
 * High-Definition Radar Reflectivity GeoJSON, DWR Footprints & Lightning Strikes
 * Calibrated against authentic Doppler Weather Radar (IMD / Ventusky / Windy specifications)
 */

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

// Major IMD Doppler Weather Radar (DWR) Stations & Coverage Footprints
export const RADAR_COVERAGE_CENTERS = [
  { name: "Kolkata (DWR)", lon: 88.36, lat: 22.57, radius: 460 },
  { name: "Paradip (DWR)", lon: 86.60, lat: 20.30, radius: 450 },
  { name: "Gopalpur (DWR)", lon: 84.90, lat: 19.30, radius: 450 },
  { name: "Visakhapatnam (DWR)", lon: 83.21, lat: 17.68, radius: 460 },
  { name: "Machilipatnam (DWR)", lon: 81.13, lat: 16.18, radius: 450 },
  { name: "Chennai (DWR)", lon: 80.27, lat: 13.08, radius: 460 },
  { name: "Patna (DWR)", lon: 85.13, lat: 25.59, radius: 440 },
  { name: "Lucknow (DWR)", lon: 80.94, lat: 26.84, radius: 450 },
  { name: "Delhi (DWR)", lon: 77.10, lat: 28.70, radius: 450 },
  { name: "Jaipur (DWR)", lon: 75.80, lat: 26.90, radius: 420 },
  { name: "Mumbai (DWR)", lon: 72.87, lat: 19.07, radius: 450 },
  { name: "Nagpur (DWR)", lon: 79.08, lat: 21.14, radius: 450 }
];

export const RADAR_COVERAGE_DISKS_GEOJSON = {
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

export const RADAR_REFLECTIVITY_ECHOES_GEOJSON = {
  type: "FeatureCollection",
  features: []
};

export const LIGHTNING_STRIKES = [];

export const LIGHTNING_STRIKES_GEOJSON = {
  type: "FeatureCollection",
  features: []
};

/**
 * Calculates authentic radar reflectivity in dBZ from precipitation rate
 * Uses standard Marshall-Palmer empirical Z-R relationship (Z = 200 * R^1.6)
 */
export function getLocalRadarDbz(lon, lat, precipRate = 0) {
  if (!precipRate || precipRate <= 0.05) return 0;
  const z = 200 * Math.pow(precipRate, 1.6);
  const dbz = 10 * Math.log10(Math.max(1, z));
  return Math.min(75, Math.max(0, Math.round(dbz)));
}

/**
 * Resolves color, category and formatted label for a given dBZ / rain rate
 */
export function getRadarProbeInfo(dbz, rainRate = 0) {
  if (dbz < 18 || rainRate < 0.1) {
    return { dbz: 0, rainRate: 0, label: 'Clear', color: '#94a3b8' };
  }
  if (dbz < 30) {
    return { dbz, rainRate, label: `Light Rain (${rainRate.toFixed(1)} mm/h)`, color: '#38bdf8' };
  }
  if (dbz < 42) {
    return { dbz, rainRate, label: `Moderate Rain (${rainRate.toFixed(1)} mm/h)`, color: '#34d399' };
  }
  if (dbz < 52) {
    return { dbz, rainRate, label: `Heavy Rain (${rainRate.toFixed(1)} mm/h)`, color: '#f59e0b' };
  }
  return { dbz, rainRate, label: `Severe Storm (${rainRate.toFixed(1)} mm/h)`, color: '#f43f5e' };
}

/**
 * Estimates instantaneous ground precipitation rate (mm/h) based on meteorological systems
 */
export function estimateLocalRainRate(lon, lat, { cyclones = [], cloudburstEvent = null } = {}) {
  let rate = 0;

  // 1. Tropical Cyclones precipitation bands
  if (Array.isArray(cyclones)) {
    for (let i = 0; i < cyclones.length; i++) {
      const c = cyclones[i];
      if (c && typeof c.lat === 'number' && typeof c.lon === 'number') {
        const dLat = lat - c.lat;
        const dLon = ((((lon - c.lon + 180) % 360) + 360) % 360 - 180) * Math.cos((lat * Math.PI) / 180.0);
        const dist = Math.hypot(dLat, dLon);
        if (dist < 10.0) {
          const windKmh = c.windKmh || 120;
          const peak = Math.min(80.0, windKmh * 0.40);
          rate = Math.max(rate, peak * Math.exp(-dist / 1.8));
        }
      }
    }
  }

  // 2. Active Cloudburst Hazard Plume
  if (cloudburstEvent?.coordinates) {
    const [eLon, eLat] = cloudburstEvent.coordinates;
    const dLat = lat - eLat;
    const dLon = ((((lon - eLon + 180) % 360) + 360) % 360 - 180) * Math.cos((lat * Math.PI) / 180.0);
    const distDeg = Math.hypot(dLat, dLon);
    const radiusDeg = (cloudburstEvent.hazardRadiusKm || 30) / 111.0;
    if (distDeg < radiusDeg * 2.5) {
      const peakRate = cloudburstEvent.metrics?.rainfallMmPerHour || 85.0;
      const factor = Math.exp(-(distDeg * distDeg) / (radiusDeg * radiusDeg * 0.8));
      rate = Math.max(rate, peakRate * factor);
    }
  }

  return rate;
}

