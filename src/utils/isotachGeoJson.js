/**
 * isotachGeoJson.js
 * 
 * AeroAtelier™ Planetary Vector Isotach Horizons Generator
 * 
 * Generates smooth vector contours (isotachs) at strategic meteorological thresholds:
 * - 25 km/h (Moderate Synoptic Flow)
 * - 50 km/h (Fresh / Brisk Flow Corridor)
 * - 75 km/h (Gale Shear Boundary)
 * - 100 km/h (Severe Gale / Storm Boundary)
 * - 140 km/h (Subtropical Jetstream Core)
 * - 180 km/h (High Planetary Jetstream Core)
 * 
 * Utilizes Marching Squares contouring with altitude level awareness ('surface', '850hpa', '250hpa').
 */

import { sampleAeroSilkVector } from '../services/aeroSilkService.js';

const cachedIsotachs = new Map();

export function getPlanetaryIsotachsGeoJSON(altitudeLevel = 'surface') {
  const cacheKey = altitudeLevel || 'surface';
  if (cachedIsotachs.has(cacheKey)) {
    return cachedIsotachs.get(cacheKey);
  }

  const thresholds = [
    { value: 25,  id: 'iso_w25',  label: '25 km/h',  color: '#38bdf8', halo: '#082f49', isMajor: false },
    { value: 50,  id: 'iso_w50',  label: '50 km/h',  color: '#34d399', halo: '#064e3b', isMajor: true  },
    { value: 75,  id: 'iso_w75',  label: '75 km/h',  color: '#facc15', halo: '#713f12', isMajor: false },
    { value: 100, id: 'iso_w100', label: '100 km/h', color: '#fb923c', halo: '#7c2d12', isMajor: true  },
    { value: 140, id: 'iso_w140', label: '140 km/h', color: '#c084fc', halo: '#581c87', isMajor: true  },
    { value: 180, id: 'iso_w180', label: '180 km/h', color: '#f8fafc', halo: '#0f172a', isMajor: true  }
  ];

  const minLon = -180, maxLon = 180, lonStep = 2.5;
  const minLat = -75, maxLat = 75, latStep = 2.0;

  const cols = Math.floor((maxLon - minLon) / lonStep) + 1;
  const rows = Math.floor((maxLat - minLat) / latStep) + 1;

  // Pre-sample grid with real NWP vector speeds
  const grid = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const lat = minLat + r * latStep;
    for (let c = 0; c < cols; c++) {
      const lon = minLon + c * lonStep;
      const vec = sampleAeroSilkVector(lon, lat, 0, altitudeLevel);
      grid[r * cols + c] = vec.speed * 13.5; // Convert normalized vector speed to km/h
    }
  }

  const features = [];

  thresholds.forEach((th) => {
    const segments = [];
    const val = th.value;

    for (let r = 0; r < rows - 1; r++) {
      const lat0 = minLat + r * latStep;
      const lat1 = lat0 + latStep;

      for (let c = 0; c < cols - 1; c++) {
        const lon0 = minLon + c * lonStep;
        const lon1 = lon0 + lonStep;

        const vBL = grid[r * cols + c];
        const vBR = grid[r * cols + c + 1];
        const vTL = grid[(r + 1) * cols + c];
        const vTR = grid[(r + 1) * cols + c + 1];

        // 4 corners: BL (bit 0), BR (bit 1), TR (bit 2), TL (bit 3)
        let mask = 0;
        if (vBL >= val) mask |= 1;
        if (vBR >= val) mask |= 2;
        if (vTR >= val) mask |= 4;
        if (vTL >= val) mask |= 8;

        if (mask === 0 || mask === 15) continue;

        const lerp = (v1, v2, p1, p2) => {
          if (Math.abs(v2 - v1) < 0.0001) return (p1 + p2) * 0.5;
          const t = (val - v1) / (v2 - v1);
          return p1 + t * (p2 - p1);
        };

        const bottom = [lerp(vBL, vBR, lon0, lon1), lat0];
        const right  = [lon1, lerp(vBR, vTR, lat0, lat1)];
        const top    = [lerp(vTL, vTR, lon0, lon1), lat1];
        const left   = [lon0, lerp(vBL, vTL, lat0, lat1)];

        switch (mask) {
          case 1: case 14: segments.push([left, bottom]); break;
          case 2: case 13: segments.push([bottom, right]); break;
          case 3: case 12: segments.push([left, right]); break;
          case 4: case 11: segments.push([right, top]); break;
          case 5: segments.push([left, top], [bottom, right]); break;
          case 6: case 9:  segments.push([bottom, top]); break;
          case 7: case 8:  segments.push([left, top]); break;
          case 10: segments.push([left, bottom], [top, right]); break;
        }
      }
    }

    if (segments.length > 0) {
      features.push({
        type: 'Feature',
        properties: {
          id: th.id,
          value: th.value,
          label: th.label,
          color: th.color,
          halo: th.halo,
          isMajor: th.isMajor
        },
        geometry: {
          type: 'MultiLineString',
          coordinates: segments
        }
      });
    }
  });

  const geoJSON = {
    type: 'FeatureCollection',
    features
  };

  cachedIsotachs.set(cacheKey, geoJSON);
  return geoJSON;
}
