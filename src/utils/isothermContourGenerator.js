/**
 * Global Isotherm Contour & Adaptive City Temperature Vector Generator
 * 
 * Replaces opaque raster color washes with:
 * 1. High-precision vector isotherm contour lines (Edge-keyed Marching Squares algorithm)
 * 2. Adaptive Level-of-Detail (LoD) city & station temperature micro-badges
 * 3. 100% transparent basemap preservation for Doppler radar & cloudburst risk
 */

import { computeGlobalThermodynamicTemp, getTempColorHex, formatTemperature } from './temperatureUtils.js';

// Standard synoptic meteorological contour intervals (5°C step)
export const ISOTHERM_LEVELS = [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40];

// Curated regional cities and meteorological stations with progressive Level-of-Detail
export const REGIONAL_CITIES = [
  // Tier 1: National capital & primary metros (minZoom: 0)
  { name: 'New Delhi', lon: 77.209, lat: 28.614, minZoom: 0 },
  { name: 'Mumbai', lon: 72.877, lat: 19.076, minZoom: 0 },
  { name: 'Kolkata', lon: 88.364, lat: 22.573, minZoom: 0 },
  { name: 'Chennai', lon: 80.270, lat: 13.083, minZoom: 0 },
  { name: 'Bengaluru', lon: 77.594, lat: 12.972, minZoom: 0 },
  { name: 'Dehradun', lon: 78.032, lat: 30.316, minZoom: 0 },
  { name: 'Srinagar', lon: 74.797, lat: 34.084, minZoom: 0 },
  { name: 'Guwahati', lon: 91.736, lat: 26.144, minZoom: 0 },
  { name: 'Hyderabad', lon: 78.486, lat: 17.385, minZoom: 0 },
  { name: 'Kathmandu', lon: 85.324, lat: 27.717, minZoom: 0 },

  // Tier 2: Major regional hubs & mountain foothill gateways (minZoom: 4.5)
  { name: 'Shimla', lon: 77.173, lat: 31.104, minZoom: 4.5 },
  { name: 'Leh', lon: 77.577, lat: 34.153, minZoom: 4.5 },
  { name: 'Jaipur', lon: 75.787, lat: 26.912, minZoom: 4.5 },
  { name: 'Ahmedabad', lon: 72.571, lat: 23.022, minZoom: 4.5 },
  { name: 'Lucknow', lon: 80.946, lat: 26.846, minZoom: 4.5 },
  { name: 'Patna', lon: 85.137, lat: 25.594, minZoom: 4.5 },
  { name: 'Bhopal', lon: 77.412, lat: 23.259, minZoom: 4.5 },
  { name: 'Bhubaneswar', lon: 85.824, lat: 20.296, minZoom: 4.5 },
  { name: 'Kochi', lon: 76.267, lat: 9.931, minZoom: 4.5 },
  { name: 'Ranchi', lon: 85.309, lat: 23.344, minZoom: 4.5 },
  { name: 'Shillong', lon: 91.893, lat: 25.578, minZoom: 4.5 },
  { name: 'Gangtok', lon: 88.613, lat: 27.331, minZoom: 4.5 },
  { name: 'Dhaka', lon: 90.412, lat: 23.810, minZoom: 4.5 },
  { name: 'Colombo', lon: 79.861, lat: 6.927, minZoom: 4.5 },
  { name: 'Lahore', lon: 74.358, lat: 31.520, minZoom: 4.5 },
  { name: 'Dubai', lon: 55.270, lat: 25.204, minZoom: 4.5 },

  // Tier 3: District and station gateways (minZoom: 6.2)
  { name: 'Haridwar', lon: 78.164, lat: 29.945, minZoom: 6.2 },
  { name: 'Rishikesh', lon: 78.267, lat: 30.086, minZoom: 6.2 },
  { name: 'Uttarkashi', lon: 78.435, lat: 30.726, minZoom: 6.2 },
  { name: 'Chamoli', lon: 79.353, lat: 30.293, minZoom: 6.2 },
  { name: 'Nainital', lon: 79.459, lat: 29.391, minZoom: 6.2 },
  { name: 'Dharamshala', lon: 76.321, lat: 32.219, minZoom: 6.2 },
  { name: 'Manali', lon: 77.188, lat: 32.239, minZoom: 6.2 },
  { name: 'Pune', lon: 73.856, lat: 18.520, minZoom: 6.2 },
  { name: 'Nagpur', lon: 79.088, lat: 21.145, minZoom: 6.2 },
  { name: 'Surat', lon: 72.831, lat: 21.170, minZoom: 6.2 },
  { name: 'Chandigarh', lon: 76.779, lat: 30.733, minZoom: 6.2 },
  { name: 'Varanasi', lon: 82.973, lat: 25.317, minZoom: 6.2 },
  { name: 'Visakhapatnam', lon: 83.218, lat: 17.686, minZoom: 6.2 },
  { name: 'Indore', lon: 75.857, lat: 22.719, minZoom: 6.2 },
  { name: 'Coimbatore', lon: 76.955, lat: 11.016, minZoom: 6.2 }
];

let cachedGeoJSON = null;
let lastCycloneCount = -1;

/**
 * Generates GeoJSON FeatureCollection of Isotherm Contours
 * Uses exact edge-keyed Marching Squares to ensure continuous, unbroken global lines
 */
export function generateIsothermContourGeoJSON(cycloneCount = 0) {
  if (cachedGeoJSON && cycloneCount === lastCycloneCount) {
    return cachedGeoJSON;
  }

  const minLon = -180;
  const maxLon = 180;
  const minLat = -58;
  const maxLat = 74;
  const step = 0.85; // 0.85 degree grid provides smooth curvature while computing in <50ms

  const nx = Math.floor((maxLon - minLon) / step) + 1;
  const ny = Math.floor((maxLat - minLat) / step) + 1;

  const grid = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const lat = minLat + j * step;
    for (let i = 0; i < nx; i++) {
      const lon = minLon + i * step;
      grid[j * nx + i] = computeGlobalThermodynamicTemp(lon, lat);
    }
  }

  const features = [];
  const labelPoints = [];

  for (const T of ISOTHERM_LEVELS) {
    const edgePoints = new Map();

    const getHPoint = (i, j) => {
      const k = `H_${i}_${j}`;
      if (edgePoints.has(k)) return edgePoints.get(k);
      const lon0 = minLon + i * step;
      const lon1 = lon0 + step;
      const lat = minLat + j * step;
      const v0 = grid[j * nx + i];
      const v1 = grid[j * nx + (i + 1)];
      const t = (T - v0) / (v1 - v0 || 0.0001);
      const pt = [lon0 + t * (lon1 - lon0), lat];
      edgePoints.set(k, pt);
      return pt;
    };

    const getVPoint = (i, j) => {
      const k = `V_${i}_${j}`;
      if (edgePoints.has(k)) return edgePoints.get(k);
      const lon = minLon + i * step;
      const lat0 = minLat + j * step;
      const lat1 = lat0 + step;
      const v0 = grid[j * nx + i];
      const v1 = grid[(j + 1) * nx + i];
      const t = (T - v0) / (v1 - v0 || 0.0001);
      const pt = [lon, lat0 + t * (lat1 - lat0)];
      edgePoints.set(k, pt);
      return pt;
    };

    const adj = new Map();
    const addEdge = (k1, k2) => {
      if (!adj.has(k1)) adj.set(k1, []);
      if (!adj.has(k2)) adj.set(k2, []);
      adj.get(k1).push(k2);
      adj.get(k2).push(k1);
    };

    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const vD = grid[j * nx + i];             // bottom-left (lon0, lat0)
        const vC = grid[j * nx + (i + 1)];       // bottom-right (lon1, lat0)
        const vB = grid[(j + 1) * nx + (i + 1)]; // top-right (lon1, lat1)
        const vA = grid[(j + 1) * nx + i];       // top-left (lon0, lat1)

        let cellCase = 0;
        if (vD >= T) cellCase |= 1;
        if (vC >= T) cellCase |= 2;
        if (vB >= T) cellCase |= 4;
        if (vA >= T) cellCase |= 8;

        if (cellCase === 0 || cellCase === 15) continue;

        const left = `V_${i}_${j}`;
        const right = `V_${i + 1}_${j}`;
        const bottom = `H_${i}_${j}`;
        const top = `H_${i}_${j + 1}`;

        getVPoint(i, j);
        getVPoint(i + 1, j);
        getHPoint(i, j);
        getHPoint(i, j + 1);

        switch (cellCase) {
          case 1:
          case 14:
            addEdge(left, bottom);
            break;
          case 2:
          case 13:
            addEdge(bottom, right);
            break;
          case 3:
          case 12:
            addEdge(left, right);
            break;
          case 4:
          case 11:
            addEdge(top, right);
            break;
          case 5:
            addEdge(left, top);
            addEdge(bottom, right);
            break;
          case 6:
          case 9:
            addEdge(bottom, top);
            break;
          case 7:
          case 8:
            addEdge(left, top);
            break;
          case 10:
            addEdge(left, bottom);
            addEdge(top, right);
            break;
        }
      }
    }

    const visited = new Set();
    const nodes = Array.from(adj.keys());
    // Prioritize endpoints (degree 1) first so open lines don't get split
    nodes.sort((a, b) => (adj.get(a)?.length || 0) - (adj.get(b)?.length || 0));

    const color = getTempColorHex(T);

    for (const startK of nodes) {
      if (visited.has(startK)) continue;
      const line = [startK];
      visited.add(startK);

      // Extend forward
      let curr = startK;
      while (true) {
        const neighbors = adj.get(curr) || [];
        const next = neighbors.find((k) => !visited.has(k));
        if (!next) break;
        visited.add(next);
        line.push(next);
        curr = next;
      }

      // Extend backward
      let tail = startK;
      while (true) {
        const neighbors = adj.get(tail) || [];
        const prev = neighbors.find((k) => !visited.has(k));
        if (!prev) break;
        visited.add(prev);
        line.unshift(prev);
        tail = prev;
      }

      if (line.length >= 3) {
        const coords = line.map((k) => edgePoints.get(k));
        features.push({
          type: 'Feature',
          properties: {
            temp: T,
            label: `${T}°`,
            color,
            isNegative: T < 0
          },
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        });

        // Place label points evenly along each continuous contour
        for (let idx = 15; idx < coords.length; idx += 35) {
          labelPoints.push({
            type: 'Feature',
            properties: {
              temp: T,
              label: `${T}°C`,
              color
            },
            geometry: {
              type: 'Point',
              coordinates: coords[idx]
            }
          });
        }
      }
    }
  }

  cachedGeoJSON = {
    type: 'FeatureCollection',
    features,
    labelFeatures: labelPoints
  };
  lastCycloneCount = cycloneCount;

  return cachedGeoJSON;
}

/**
 * Returns filtered list of cities with live calculated temperatures based on current zoom level
 */
export function getActiveCityBadges(currentZoom = 3, tempUnit = 'C') {
  return REGIONAL_CITIES.filter((c) => currentZoom >= c.minZoom).map((city) => {
    const rawTemp = computeGlobalThermodynamicTemp(city.lon, city.lat);
    const color = getTempColorHex(rawTemp);
    const label = formatTemperature(rawTemp, tempUnit);
    return {
      ...city,
      rawTemp,
      color,
      label
    };
  });
}
