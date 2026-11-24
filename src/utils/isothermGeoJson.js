/**
 * Global Planetary Isotherm Horizons Generator
 *
 * Generates smooth vector contours for key cognitive thermal thresholds:
 * - 0°C Frost Horizon (Cryosphere boundary)
 * - 20°C Comfort Horizon (Human baseline)
 * - 35°C Heat Dome Horizon (Severe convective heat)
 */

import { computeGlobalThermodynamicTemp } from './temperatureUtils.js';

let cachedIsotherms = null;

export function getPlanetaryIsothermsGeoJSON() {
  if (cachedIsotherms) return cachedIsotherms;

  const thresholds = [
    { value: -10, id: 'iso_m10', label: '-10°', color: '#5650ab', halo: '#1e1b4b', isMajor: true },
    { value: -5,  id: 'iso_m5',  label: '-5°',  color: '#4178be', halo: '#1e3a8a', isMajor: false },
    { value: 0,   id: 'iso_0',   label: '0°',   color: '#4eb195', halo: '#064e3b', isMajor: true },
    { value: 5,   id: 'iso_5',   label: '5°',   color: '#5cca4d', halo: '#14532d', isMajor: false },
    { value: 10,  id: 'iso_10',  label: '10°',  color: '#b7da40', halo: '#365314', isMajor: true },
    { value: 15,  id: 'iso_15',  label: '15°',  color: '#e1ce39', halo: '#713f12', isMajor: false },
    { value: 20,  id: 'iso_20',  label: '20°',  color: '#e09f41', halo: '#7c2d12', isMajor: true },
    { value: 25,  id: 'iso_25',  label: '25°',  color: '#dc6d55', halo: '#991b1b', isMajor: false },
    { value: 30,  id: 'iso_30',  label: '30°',  color: '#b73466', halo: '#831843', isMajor: true },
    { value: 35,  id: 'iso_35',  label: '35°',  color: '#9b4a6d', halo: '#500724', isMajor: false },
    { value: 40,  id: 'iso_40',  label: '40°',  color: '#6b1527', halo: '#4c0519', isMajor: true }
  ];

  const minLon = -180, maxLon = 180, lonStep = 2.0;
  const minLat = -55, maxLat = 75, latStep = 1.6;

  const cols = Math.floor((maxLon - minLon) / lonStep) + 1;
  const rows = Math.floor((maxLat - minLat) / latStep) + 1;

  // Pre-sample grid with closed-form thermodynamic evaluation
  const grid = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const lat = minLat + r * latStep;
    for (let c = 0; c < cols; c++) {
      const lon = minLon + c * lonStep;
      grid[r * cols + c] = computeGlobalThermodynamicTemp(lon, lat);
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

  cachedIsotherms = {
    type: 'FeatureCollection',
    features
  };

  return cachedIsotherms;
}

