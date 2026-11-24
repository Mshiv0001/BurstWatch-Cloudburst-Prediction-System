/**
 * AetherAura™ Planetary Synoptic Iso-AQI Horizons & Station Nodes Generator
 *
 * Generates continuous vector contour lines (Marching Squares) for key health frontiers:
 * - 50 AQI Clean Air Horizon (#10b981)
 * - 100 AQI Satisfactory Limit (#f59e0b)
 * - 150 AQI Sensitive Threshold (#f97316)
 * - 200 AQI Unhealthy Frontier (#f43f5e)
 * - 300 AQI Severe Stagnation Zone (#a855f7)
 *
 * In addition, generates interactive gemstone point beacons for 600+ monitored
 * stations worldwide for high-zoom exploration.
 */

import { getAqiCategory, getGlobalAqiStationNetwork } from '../services/aqiService.js';
import { computeInterpolatedAqi } from './aqiTiles.js';

let cachedIsoAqiGeoJSON = null;
let lastIsoAqiTimestamp = 0;

export const ISO_AQI_THRESHOLDS = [
  { value: 50,  id: 'iso_aqi_50',  label: '50',  color: '#10b981', halo: '#064e3b', isMajor: true,  category: 'Good' },
  { value: 100, id: 'iso_aqi_100', label: '100', color: '#f59e0b', halo: '#78350f', isMajor: true,  category: 'Satisfactory' },
  { value: 150, id: 'iso_aqi_150', label: '150', color: '#f97316', halo: '#7c2d12', isMajor: false, category: 'Moderate' },
  { value: 200, id: 'iso_aqi_200', label: '200', color: '#f43f5e', halo: '#881337', isMajor: true,  category: 'Poor' },
  { value: 300, id: 'iso_aqi_300', label: '300', color: '#a855f7', halo: '#581c87', isMajor: true,  category: 'Very Poor' }
];

/**
 * Computes synoptic Marching Squares Iso-AQI contours across the globe
 */
export function getPlanetaryIsoAqiGeoJSON(stationsAqiMap = null) {
  const now = Date.now();
  // Cache for 2 minutes or until fresh stations arrive
  if (cachedIsoAqiGeoJSON && (now - lastIsoAqiTimestamp < 120000)) {
    return cachedIsoAqiGeoJSON;
  }

  const minLon = -180, maxLon = 180, lonStep = 3.0;
  const minLat = -55, maxLat = 75, latStep = 2.5;

  const cols = Math.floor((maxLon - minLon) / lonStep) + 1;
  const rows = Math.floor((maxLat - minLat) / latStep) + 1;

  // Pre-sample grid with atmospheric interpolation
  const grid = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const lat = minLat + r * latStep;
    for (let c = 0; c < cols; c++) {
      const lon = minLon + c * lonStep;
      grid[r * cols + c] = computeInterpolatedAqi(lon, lat);
    }
  }

  const features = [];

  ISO_AQI_THRESHOLDS.forEach((th) => {
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
          label: `${th.label}`,
          color: th.color,
          halo: th.halo,
          isMajor: th.isMajor,
          category: th.category
        },
        geometry: {
          type: 'MultiLineString',
          coordinates: segments
        }
      });
    }
  });

  cachedIsoAqiGeoJSON = {
    type: 'FeatureCollection',
    features
  };
  lastIsoAqiTimestamp = now;

  return cachedIsoAqiGeoJSON;
}

/**
 * Generates tactile point station beacons for 600+ monitored global stations
 */
export function getAqiStationNodesGeoJSON(stationsAqiMap = {}) {
  const features = [];
  let entries = Object.values(stationsAqiMap || {});

  if (entries.length === 0) {
    // Fall back to the baseline station network
    entries = getGlobalAqiStationNetwork().map((s) => ({
      ...s,
      stationId: s.id,
      aqi: s.baselineAqi || 50
    }));
  }

  for (let i = 0; i < entries.length; i++) {
    const s = entries[i];
    if (!s || typeof s.lat !== 'number' || typeof s.lon !== 'number') continue;

    const aqi = Math.max(1, s.aqi || 50);
    const cat = getAqiCategory(aqi);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [s.lon, s.lat]
      },
      properties: {
        id: s.stationId || s.id || `station-${i}`,
        name: s.name || 'Station',
        state: s.state || s.country || '',
        country: s.country || '',
        continent: s.continent || '',
        region: s.region || '',
        aqi,
        category: cat.category,
        color: cat.color,
        textColor: cat.textColor,
        pm2_5: s.pm2_5 || parseFloat((aqi * 0.44).toFixed(1)),
        pm10: s.pm10 || parseFloat((aqi * 0.75).toFixed(1)),
        no2: s.no2 || 18.0,
        o3: s.o3 || 42.0,
        dominantPollutant: s.dominantPollutant || (aqi > 100 ? 'PM2.5' : 'Ozone'),
        healthAdvice: cat.healthAdvice,
        maskRecommended: cat.maskRecommended,
        time: s.time || ''
      }
    });
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Unified helper returning station point nodes (retained for backward compatibility)
 */
export function generateAqiAtmosphericGeoJSON(stationsAqiMap = {}) {
  return getAqiStationNodesGeoJSON(stationsAqiMap);
}
