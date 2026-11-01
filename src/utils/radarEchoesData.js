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
