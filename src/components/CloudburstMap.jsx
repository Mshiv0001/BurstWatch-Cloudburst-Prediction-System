import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Plus, 
  Minus, 
  Compass, 
  Zap, 
  Thermometer, 
  CloudRain, 
  Wind, 
  Sparkles, 
  MapPin 
} from 'lucide-react';
import { STATIONS_NETWORK } from '../data/cloudburstData';
import { isIndiaSector } from '../utils/geoUtils';
import { 
  celsiusToFahrenheit,
  computeGlobalThermodynamicTemp,
  ACTIVE_CYCLONES,
  getWindSpeedColor,
  getWindSpeedCategory,
  getTempColorHex
} from '../utils/temperatureUtils';
import { generateCloudburstHeatmapGeoJSON } from '../utils/heatmapGeoJson';
import { WEATHER_LAYERS, getWeatherApiTileUrl } from '../utils/weatherTiles';
import {
  LIGHTNING_STRIKES_GEOJSON,
  getLocalRadarDbz
} from '../utils/radarEchoesData';
import { generateHazardRadiusGeoJSON } from '../services/cloudburstEventModel';

// OpenFreeMap Official Vector Style Endpoints (Free, no API key required)
export const OPENFREEMAP_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  positron: "https://tiles.openfreemap.org/styles/positron",
  bright: "https://tiles.openfreemap.org/styles/bright"
};

// MapLibre GL JS Built-in Heatmap Layer Identifiers
const HEATMAP_SOURCE_ID = 'cloudburst-heatmap-source';
const HEATMAP_LAYER_ID = 'cloudburst-heatmap-layer';
const HEATMAP_POINT_LAYER_ID = 'cloudburst-heatmap-points';

// Globally Continuous, Infinitely Differentiable (C^inf) Atmospheric Vector Field
function getWindVector(lon, lat) {
  const normLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const latRad = (lat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  
  let u = 0;
  let v = 0;

  // 1. Globally Continuous Planetary Circulation (Zero piecewise boundaries or step functions)
  // - Easterly Trade Winds in the Tropics (lat -30 to +30)
  // - Westerly Jet Stream in Mid-Latitudes (lat 30 to 60)
  // - Gentle Polar Easterlies at high latitudes
  u += -3.4 * Math.cos(latRad * 3.0) + 1.1 * cosLat;
  v += -0.85 * Math.sin(latRad * 2.0);

  // 2. Continuous Subtropical Anticyclonic Ocean Gyres (Clockwise North, Counter-clockwise South)
  if (Math.abs(lat) < 70) {
    const gyreAtl = Math.sin((normLon + 45) * 0.055);
    const gyrePac = Math.sin((normLon + 140) * 0.045);
    v += (gyreAtl + gyrePac) * 1.2 * Math.cos(latRad * 1.5);
    u += Math.cos(latRad * 2.5) * 0.8;
  }

  // 3. Multi-octave Divergence-Free Streamfunction Waves (Parallel laminar ribbons)
  const k1 = 0.10, m1 = 0.08;
  u += -1.4 * m1 * Math.sin(normLon * k1) * Math.sin(lat * m1);
  v += -1.4 * k1 * Math.cos(normLon * k1) * Math.cos(lat * m1);

  const k2 = 0.22, m2 = 0.16;
  u += 0.7 * m2 * Math.cos(normLon * k2) * Math.cos(lat * m2);
  v += 0.7 * k2 * Math.sin(normLon * k2) * Math.sin(lat * m2);

  // 4. Arabian Sea & Indian Ocean Cross-Equatorial Monsoon Jet
  // Smooth 2D Gaussian envelope centered at (Lon 70°E, Lat 9°N) with wide sigmas (zero boundary cuts)
  const dLonMon = normLon - 70.0;
  const dLatMon = lat - 9.0;
  const envMon = Math.exp(-(dLonMon * dLonMon) / (2 * 18 * 18) - (dLatMon * dLatMon) / (2 * 11 * 11));
  if (envMon > 0.005) {
    // Flows northeastward across Arabian Sea, turning eastward south of India/Sri Lanka
    u += envMon * 5.2;
    v += envMon * (2.1 - 0.06 * dLonMon);
  }

  // 5. Bay of Bengal Cyclonic Depression (Centering precisely at 17°03'N 88°20'E: Lon 88.33°E, Lat 17.05°N)
  // Continuous Gaussian-Rankine vortex with solid-body core (zero singularity) and asymptotic decay
  const dxBoB = normLon - 88.33;
  const dyBoB = lat - 17.05;
  const rSqBoB = dxBoB * dxBoB + dyBoB * dyBoB;
  const envBoB = Math.exp(-rSqBoB / (2 * 6.5 * 6.5));
  if (envBoB > 0.005) {
    const r = Math.sqrt(rSqBoB);
    const rCore = 2.4;
    // Tangential speed: linear at center, peaks at rCore, then smoothly decays
    const vTan = (13.5 * (r / rCore)) / (1.0 + (r / rCore) ** 2) * envBoB;
    const invR = 1.0 / (r + 0.15);
    // Solenoidal counter-clockwise rotation (Northern hemisphere)
    const uCirc = (-dyBoB * invR) * vTan;
    const vCirc = (dxBoB * invR) * vTan;
    // Smooth inward cyclonic spiral (~16° inflow angle)
    const uInflow = (-dxBoB * invR) * (vTan * 0.20);
    const vInflow = (-dyBoB * invR) * (vTan * 0.20);
    u += uCirc + uInflow;
    v += vCirc + vInflow;
  }

  // 6. Sri Lanka & Gulf of Mannar Coastal Deflection (Lon 80.6°E, Lat 7.8°N)
  const dxSL = normLon - 80.6;
  const dySL = lat - 7.8;
  const rSqSL = dxSL * dxSL + dySL * dySL;
  const envSL = Math.exp(-rSqSL / (2 * 3.4 * 3.4));
  if (envSL > 0.01) {
    const r = Math.sqrt(rSqSL);
    const invR = 1.0 / (r + 0.2);
    // Aerodynamic potential deflection around island
    u += (-dySL * invR) * (envSL * 3.8);
    v += (dxSL * invR) * (envSL * 3.8) - envSL * 0.8;
  }

  // 6b. Palk Strait & Jaffna Coastal Eddy (Lon 80.2°E, Lat 9.8°N)
  const dxJ = normLon - 80.2;
  const dyJ = lat - 9.8;
  const rSqJ = dxJ * dxJ + dyJ * dyJ;
  const envJ = Math.exp(-rSqJ / (2 * 2.2 * 2.2));
  if (envJ > 0.01) {
    const r = Math.sqrt(rSqJ);
    const invR = 1.0 / (r + 0.2);
    u += (-dyJ * invR) * (envJ * 2.6);
    v += (dxJ * invR) * (envJ * 2.6);
  }

  // 7. Tropical Cyclone Vance (Eastern Pacific: Lon -105.4°E, Lat 15.2°N)
  const dxVance = normLon - (-105.4);
  const dyVance = lat - 15.2;
  const rSqVance = dxVance * dxVance + dyVance * dyVance;
  const envVance = Math.exp(-rSqVance / (2 * 5.0 * 5.0));
  if (envVance > 0.01) {
    const r = Math.sqrt(rSqVance);
    const vTan = (10.0 * (r / 2.2)) / (1.0 + (r / 2.2) ** 2) * envVance;
    const invR = 1.0 / (r + 0.15);
    u += (-dyVance * invR) * vTan - (dxVance * invR) * (vTan * 0.2);
    v += (dxVance * invR) * vTan - (dyVance * invR) * (vTan * 0.2);
  }

  // 8. Tropical Cyclone Infa (Western Pacific: Lon 162.0°E, Lat 15.5°N)
  const dxInfa = normLon - 162.0;
  const dyInfa = lat - 15.5;
  const rSqInfa = dxInfa * dxInfa + dyInfa * dyInfa;
  const envInfa = Math.exp(-rSqInfa / (2 * 5.0 * 5.0));
  if (envInfa > 0.01) {
    const r = Math.sqrt(rSqInfa);
    const vTan = (10.5 * (r / 2.2)) / (1.0 + (r / 2.2) ** 2) * envInfa;
    const invR = 1.0 / (r + 0.15);
    u += (-dyInfa * invR) * vTan - (dxInfa * invR) * (vTan * 0.2);
    v += (dxInfa * invR) * vTan - (dyInfa * invR) * (vTan * 0.2);
  }

  const mag = Math.sqrt(u * u + v * v);
  return { u, v, mag };
}

function getLocalTemperature(lon, lat) {
  return Math.round(computeGlobalThermodynamicTemp(lon, lat));
}

function getLocalWindSpeed(lon, lat) {
  const vec = getWindVector(lon, lat);
  return Math.round(vec.mag * 13.5);
}

function getLocalPrecipitation(lon, lat, stations = STATIONS_NETWORK) {
  const dbz = getLocalRadarDbz(lon, lat);
  if (dbz >= 56) return 65.0;
  if (dbz >= 50) return 42.0;
  if (dbz >= 40) return 25.0;
  if (dbz >= 30) return 12.0;
  if (dbz >= 20) return 4.5;
  if (dbz >= 10) return 1.5;
  if (dbz > 0) return 0.5;

  let rain = 0;
  if (stations && stations.length > 0) {
    for (let i = 0; i < stations.length; i++) {
      const s = stations[i];
      const dLat = lat - s.lat;
      const dLon = (lon - s.lon) * Math.cos((lat * Math.PI) / 180);
      const distSq = dLat * dLat + dLon * dLon;
      if (distSq < 2.2) {
        const factor = Math.exp(-distSq / 0.45);
        const stnRain = Number(s.rainRate ?? s.precipitation ?? (s.humidity > 80 ? (s.humidity - 70) * 1.5 : 0));
        rain = Math.max(rain, stnRain * factor);
      }
    }
  }
  for (const c of ACTIVE_CYCLONES) {
    const dLat = lat - c.lat;
    const dLon = (lon - c.lon) * Math.cos((lat * Math.PI) / 180);
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < 16) {
      const dist = Math.sqrt(distSq);
      const cRain = 55 * Math.exp(-dist / 1.6);
      rain = Math.max(rain, cRain);
    }
  }
  return Math.round(rain * 10) / 10;
}

function getLocalPressure(lon, lat) {
  let p = 1013;
  for (const c of ACTIVE_CYCLONES) {
    const dLat = lat - c.lat;
    const dLon = (lon - c.lon) * Math.cos((lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < 5.0) {
      const drop = 35 * Math.exp(-dist / 1.8);
      p -= drop;
    }
  }
  if (lat >= 29.0 && lat <= 36.0 && lon >= 74.0 && lon <= 88.0) {
    p -= 12;
  }
  return Math.round(p);
}

function getLocalConvectiveRisk(lon, lat, stations = STATIONS_NETWORK, threatData = null) {
  let risk = 15;
  if (stations && stations.length > 0) {
    for (let i = 0; i < stations.length; i++) {
      const s = stations[i];
      const dLat = lat - s.lat;
      const dLon = (lon - s.lon) * Math.cos((lat * Math.PI) / 180);
      const distSq = dLat * dLat + dLon * dLon;
      if (distSq < 1.8) {
        const factor = Math.exp(-distSq / 0.35);
        const stnRisk = threatData?.riskPercent ?? 88;
        risk = Math.max(risk, Math.round(stnRisk * factor));
      }
    }
  }
  if (lat >= 29.5 && lat <= 33.5 && lon >= 76.5 && lon <= 81.5) {
    risk = Math.max(risk, 78);
  }
  return Math.min(99, Math.round(risk));
}

function getSectorName(lon, lat) {
  if (lat >= 30.2 && lat <= 31.5 && lon >= 78.0 && lon <= 80.5) return 'Uttarakhand (Garhwal)';
  if (lat >= 31.2 && lat <= 33.2 && lon >= 75.8 && lon <= 77.8) return 'Himachal Pradesh';
  if (lat >= 33.5 && lon >= 74.0 && lon <= 76.5) return 'Jammu & Kashmir';
  if (lat >= 27.5 && lat <= 29.5 && lon >= 76.0 && lon <= 78.5) return 'Delhi NCR';
  if (lat >= 25.0 && lat <= 28.5 && lon >= 70.0 && lon <= 75.0) return 'Rajasthan / Thar';
  if (lat >= 18.0 && lat <= 20.5 && lon >= 72.0 && lon <= 74.0) return 'Maharashtra / Mumbai';
  if (lon >= 85.0 && lon <= 95.0 && lat >= 12.0 && lat <= 22.0) return 'Bay of Bengal Basin';
  if (lon >= 60.0 && lon <= 74.0 && lat >= 10.0 && lat <= 23.0) return 'Arabian Sea Current';

  const absLat = Math.abs(lat);
  if (lat > 65) return `Arctic Ocean (${lat.toFixed(1)}°N)`;
  if (lat < -60) return `Antarctica (${absLat.toFixed(1)}°S)`;
  if (lon >= -170 && lon <= -50 && lat >= 15 && lat <= 70) return `North America (${lat.toFixed(1)}°N, ${Math.abs(lon).toFixed(1)}°W)`;
  if (lon >= -90 && lon <= -30 && lat >= -55 && lat < 15) return `South America (${lat.toFixed(1)}°, ${Math.abs(lon).toFixed(1)}°W)`;
  if (lon >= -25 && lon <= 45 && lat >= 35 && lat <= 70) return `Europe (${lat.toFixed(1)}°N)`;
  if (lon >= -20 && lon <= 55 && lat >= -35 && lat < 35) return `Africa (${lat.toFixed(1)}°)`;
  if (lon >= 35 && lon <= 65 && lat >= 12 && lat <= 35) return `Middle East (${lat.toFixed(1)}°N)`;
  if (lon >= 45 && lon <= 90 && lat >= 35 && lat <= 65) return `Central Asia (${lat.toFixed(1)}°N)`;
  if (lon >= 95 && lon <= 150 && lat >= 20 && lat <= 55) return `East Asia (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E)`;
  if (lon >= 95 && lon <= 140 && lat >= -10 && lat < 20) return `Southeast Asia (${lat.toFixed(1)}°)`;
  if (lon >= 110 && lon <= 160 && lat >= -45 && lat < -10) return `Australia (${absLat.toFixed(1)}°S)`;
  if (lon >= -60 && lon <= -10 && lat >= 0 && lat <= 60) return `North Atlantic`;
  if (lon >= -50 && lon <= 20 && lat < 0 && lat >= -60) return `South Atlantic`;
  if (lon >= 140 || lon <= -120) return `Pacific Ocean`;

  return `Sector (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;
}

/**
 * High-Precision Geodesic Dynamic Map Scale Calculator
 * Computes exact ground resolution (km or miles) from screen viewport coordinates
 */
function calculateMapScale(map, maxWidth = 76, unit = 'metric') {
  if (!map) return { widthPx: 64, label: unit === 'metric' ? '200 km' : '100 mi' };

  try {
    const container = map.getContainer();
    if (!container) return { widthPx: 64, label: unit === 'metric' ? '200 km' : '100 mi' };

    const y = container.clientHeight - 40;
    const x1 = 40;
    const x2 = x1 + maxWidth;

    const p1 = map.unproject([x1, y]);
    const p2 = map.unproject([x2, y]);

    // Haversine geodesic distance in meters
    const R = 6371008.8; // Earth radius in meters
    const rad = Math.PI / 180;
    const lat1 = p1.lat * rad;
    const lat2 = p2.lat * rad;
    const dLat = (p2.lat - p1.lat) * rad;
    const dLon = (p2.lng - p1.lng) * rad;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const maxMeters = R * c;

    if (!maxMeters || !isFinite(maxMeters) || maxMeters <= 0) {
      return { widthPx: 64, label: unit === 'metric' ? '200 km' : '100 mi' };
    }

    if (unit === 'imperial') {
      const maxMiles = maxMeters * 0.000621371;
      const niceMiles = [
        5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1
      ];
      const targetMiles = niceMiles.find((d) => d <= maxMiles) || niceMiles[niceMiles.length - 1];
      const widthPx = Math.max(22, Math.min(maxWidth, Math.round((targetMiles / maxMiles) * maxWidth)));
      const label = targetMiles >= 1 ? `${targetMiles} mi` : `${Math.round(targetMiles * 5280)} ft`;
      return { widthPx, label };
    }

    // Standard metric scale stops in meters
    const niceMeters = [
      10000000, 5000000, 2000000, 1000000, 500000, 200000, 100000,
      50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10
    ];
    const targetMeters = niceMeters.find((d) => d <= maxMeters) || niceMeters[niceMeters.length - 1];
    const widthPx = Math.max(22, Math.min(maxWidth, Math.round((targetMeters / maxMeters) * maxWidth)));
    const label = targetMeters >= 1000 ? `${targetMeters / 1000} km` : `${targetMeters} m`;
    return { widthPx, label };
  } catch (err) {
    return { widthPx: 64, label: unit === 'metric' ? '200 km' : '100 mi' };
  }
}

/**
 * Dynamic Typography Engine for MapLibre Place Labels
 */
function applyMapLabelsTheme(map, isSatelliteView) {
  if (!map || !map.isStyleLoaded()) return;

  const layers = map.getStyle()?.layers || [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const id = layer.id;

    if (layer.type === 'symbol') {
      const isPlace = id.startsWith('label_') || id.includes('place') || id.includes('settlement');
      const isWater = id.includes('water');
      const isRoad = id.startsWith('highway-name-') || id.includes('road');
      const isPoi = id.startsWith('poi_') || id === 'airport';

      try {
        if (isSatelliteView) {
          if (isPlace) {
            map.setPaintProperty(id, 'text-color', '#ffffff');
            map.setPaintProperty(id, 'text-halo-color', 'rgba(0, 0, 0, 0.92)');
            map.setPaintProperty(id, 'text-halo-width', 1.8);
            map.setPaintProperty(id, 'text-halo-blur', 1.2);
            if (layer.layout?.['icon-image']) {
              map.setPaintProperty(id, 'icon-opacity', 0);
            }
          } else if (isWater) {
            map.setPaintProperty(id, 'text-color', '#93c5fd');
            map.setPaintProperty(id, 'text-halo-color', 'rgba(2, 6, 23, 0.94)');
            map.setPaintProperty(id, 'text-halo-width', 1.6);
            map.setPaintProperty(id, 'text-halo-blur', 1.2);
          } else if (isRoad || isPoi) {
            map.setPaintProperty(id, 'text-color', '#f1f5f9');
            map.setPaintProperty(id, 'text-halo-color', 'rgba(0, 0, 0, 0.90)');
            map.setPaintProperty(id, 'text-halo-width', 1.5);
            map.setPaintProperty(id, 'text-halo-blur', 1.0);
            if (layer.layout?.['icon-image']) {
              map.setPaintProperty(id, 'icon-opacity', 0.6);
            }
          } else if (layer.layout?.['text-field']) {
            map.setPaintProperty(id, 'text-color', '#ffffff');
            map.setPaintProperty(id, 'text-halo-color', 'rgba(0, 0, 0, 0.92)');
            map.setPaintProperty(id, 'text-halo-width', 1.6);
            map.setPaintProperty(id, 'text-halo-blur', 1.2);
          }
        } else {
          if (isPlace) {
            map.setPaintProperty(id, 'text-color', '#1e293b');
            map.setPaintProperty(id, 'text-halo-color', 'rgba(255, 255, 255, 0.95)');
            map.setPaintProperty(id, 'text-halo-width', 1.5);
            map.setPaintProperty(id, 'text-halo-blur', 1.0);
            if (layer.layout?.['icon-image']) {
              map.setPaintProperty(id, 'icon-opacity', 0.8);
            }
          } else if (isWater) {
            map.setPaintProperty(id, 'text-color', '#3b6998');
            map.setPaintProperty(id, 'text-halo-color', 'rgba(255, 255, 255, 0.85)');
            map.setPaintProperty(id, 'text-halo-width', 1.5);
            map.setPaintProperty(id, 'text-halo-blur', 1.0);
          } else if (isRoad || isPoi) {
            map.setPaintProperty(id, 'text-color', '#475569');
            map.setPaintProperty(id, 'text-halo-color', 'rgba(255, 255, 255, 0.90)');
            map.setPaintProperty(id, 'text-halo-width', 1.2);
            map.setPaintProperty(id, 'text-halo-blur', 0.8);
            if (layer.layout?.['icon-image']) {
              map.setPaintProperty(id, 'icon-opacity', 0.8);
            }
          } else if (layer.layout?.['text-field']) {
            map.setPaintProperty(id, 'text-color', '#1e293b');
            map.setPaintProperty(id, 'text-halo-color', 'rgba(255, 255, 255, 0.95)');
            map.setPaintProperty(id, 'text-halo-width', 1.5);
            map.setPaintProperty(id, 'text-halo-blur', 1.0);
          }
        }
      } catch (err) {}
    }

    if (id === 'boundary_2' || id === 'boundary_3' || id === 'boundary_disputed') {
      try {
        if (isSatelliteView) {
          map.setPaintProperty(id, 'line-color', 'rgba(255, 255, 255, 0.65)');
          map.setPaintProperty(id, 'line-opacity', 0.9);
        } else {
          map.setPaintProperty(id, 'line-color', 'hsl(248, 1%, 41%)');
          map.setPaintProperty(id, 'line-opacity', 0.8);
        }
      } catch (e) {}
    }
  }
}

/**
 * Configure MapLibre GL JS Built-in Heatmap Layer, WeatherAPI Raster Tiles & Satellite Source
 */
function applyMapLayersAndHeatmap(map, isSatellite, activeLayer = 'temp', isHeatmapVisible = true, heatmapGeoJSON = null, radarTimestampPath = null, cloudburstEvent = null) {
  if (!map || !map.isStyleLoaded()) return;

  // 1. High-Resolution Global Satellite Raster Source with Google/Esri tiles
  if (!map.getSource('esri-satellite')) {
    map.addSource('esri-satellite', {
      type: 'raster',
      tiles: [
        'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: '&copy; Satellite Imagery'
    });
  }

  // Find layer before which to place satellite raster, WeatherAPI tiles & heatmap (under place labels and boundaries)
  const styleLayers = map.getStyle()?.layers || [];
  const firstLabelLayer = styleLayers.find(
    (l) => l.id === 'boundary_3' || l.id === 'boundary_2' || l.type === 'symbol'
  );
  const beforeId = firstLabelLayer ? firstLabelLayer.id : undefined;

  // 2. Base Satellite Layer
  if (!map.getLayer('base-satellite')) {
    map.addLayer({
      id: 'base-satellite',
      type: 'raster',
      source: 'esri-satellite',
      layout: {
        visibility: isSatellite ? 'visible' : 'none'
      },
      paint: {
        'raster-opacity': isSatellite ? 1.0 : 0,
        'raster-contrast': 0.12,
        'raster-brightness-max': 0.96
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('base-satellite', 'visibility', isSatellite ? 'visible' : 'none');
    map.setPaintProperty('base-satellite', 'raster-opacity', isSatellite ? 1.0 : 0);
  }

  // 3. WeatherAPI Global Continuous Raster Layers (tmp2m, precip, wind, pressure)
  const weatherRasterKeys = ['temp', 'precip', 'wind', 'pressure'];
  weatherRasterKeys.forEach((key) => {
    const cfg = WEATHER_LAYERS[key];
    if (!cfg) return;

    if (!map.getSource(cfg.sourceId)) {
      map.addSource(cfg.sourceId, {
        type: 'raster',
        tiles: [getWeatherApiTileUrl(cfg.layerKey)],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 6, // Crucial: tell MapLibre to overscale beyond zoom 6 to prevent 404s
        attribution: '&copy; WeatherAPI.com'
      });
    }

    // Rain radar (precip) uses the authentic multi-tier Doppler radar reflectivity & dark relief basemap
    const isThisRasterVisible = (activeLayer === key) && !isSatellite && (key !== 'precip');

    if (!map.getLayer(cfg.layerId)) {
      map.addLayer({
        id: cfg.layerId,
        type: 'raster',
        source: cfg.sourceId,
        layout: {
          visibility: isThisRasterVisible ? 'visible' : 'none'
        },
        paint: {
          'raster-opacity': cfg.opacity,
          'raster-fade-duration': 250
        }
      }, beforeId);
    } else {
      map.setLayoutProperty(cfg.layerId, 'visibility', isThisRasterVisible ? 'visible' : 'none');
    }
  });

  // 4. Heatmap GeoJSON Source for Convective Cloudburst Hazard Plumes
  if (heatmapGeoJSON) {
    if (!map.getSource(HEATMAP_SOURCE_ID)) {
      map.addSource(HEATMAP_SOURCE_ID, {
        type: 'geojson',
        data: heatmapGeoJSON
      });
    } else {
      map.getSource(HEATMAP_SOURCE_ID).setData(heatmapGeoJSON);
    }
  }

  // Convective Plume is visible if explicitly active ('convective') OR when viewing temperature as hazard overlay
  const isConvectiveVis = (!isSatellite && (activeLayer === 'convective' || (activeLayer === 'temp' && isHeatmapVisible)));

  // 5. MapLibre GL JS Built-in Heatmap Layer (WebGL Fragment-Shader Accelerated)
  if (!map.getLayer(HEATMAP_LAYER_ID)) {
    map.addLayer({
      id: HEATMAP_LAYER_ID,
      type: 'heatmap',
      source: HEATMAP_SOURCE_ID,
      maxzoom: 15,
      layout: {
        visibility: isConvectiveVis ? 'visible' : 'none'
      },
      paint: {
        // Convective cloudburst risk weight (0.0 to 1.0)
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'weight'],
          0.0, 0.05,
          0.3, 0.30,
          0.6, 0.65,
          1.0, 0.95
        ],
        // Intensity multiplier smoothly scaled across zoom levels
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 0.65,
          3, 1.00,
          6, 1.55,
          9, 2.10,
          12, 2.80
        ],
        // Authentic atmospheric convective cloudburst color spectrum:
        // Soft, smooth transitions without clipping to solid opaque white!
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0.00, 'rgba(0, 0, 0, 0)',
          0.10, 'rgba(49, 46, 129, 0.28)',   // Translucent deep convective indigo
          0.22, 'rgba(14, 165, 233, 0.58)',  // Active cyan flux
          0.40, 'rgba(34, 197, 94, 0.72)',   // Green unstable atmospheric boundary
          0.58, 'rgba(234, 179, 8, 0.84)',   // Warm amber squall front
          0.75, 'rgba(249, 115, 22, 0.92)',  // Vibrant orange convective updraft
          0.88, 'rgba(225, 29, 72, 0.96)',   // Crimson severe cloudburst zone
          1.00, 'rgba(254, 215, 215, 0.98)'  // Radiant soft warm rose-coral pinnacle
        ],
        // Broad radius so adjacent valley nodes seamlessly coalesce into a fluid plume
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 24,
          2, 36,
          4, 55,
          6, 80,
          8, 115,
          10, 150,
          12, 190
        ],
        'heatmap-opacity': activeLayer === 'convective' ? 0.78 : 0.45
      }
    }, beforeId);
  } else {
    map.setLayoutProperty(HEATMAP_LAYER_ID, 'visibility', isConvectiveVis ? 'visible' : 'none');
    map.setPaintProperty(HEATMAP_LAYER_ID, 'heatmap-opacity', activeLayer === 'convective' ? 0.78 : 0.45);
  }

  // 6. Convective Station Hotspot Inner Nodes (Zoom >= 7.5)
  if (!map.getLayer(HEATMAP_POINT_LAYER_ID)) {
    map.addLayer({
      id: HEATMAP_POINT_LAYER_ID,
      type: 'circle',
      source: HEATMAP_SOURCE_ID,
      minzoom: 7.5,
      filter: ['==', ['get', 'isStation'], true],
      layout: {
        visibility: isConvectiveVis ? 'visible' : 'none'
      },
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7.5, 4,
          10, 7,
          12, 11
        ],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'weight'],
          0.0, 'rgba(14, 165, 233, 0.6)',
          0.5, 'rgba(234, 179, 8, 0.85)',
          0.8, 'rgba(225, 29, 72, 0.95)',
          1.0, 'rgba(254, 215, 215, 0.98)'
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.85,
        'circle-stroke-opacity': 0.85
      }
    }, beforeId);
  } else {
    map.setLayoutProperty(HEATMAP_POINT_LAYER_ID, 'visibility', isConvectiveVis ? 'visible' : 'none');
  }

  // 6.2 Cloudburst Evacuation Hazard Radius Zone (14-18 km high-risk polygon boundary)
  if (cloudburstEvent?.coordinates) {
    const hazardGeoJSON = generateHazardRadiusGeoJSON(
      cloudburstEvent.coordinates[0],
      cloudburstEvent.coordinates[1],
      cloudburstEvent.hazardRadiusKm || 18
    );
    if (!map.getSource('cloudburst-hazard-radius-source')) {
      map.addSource('cloudburst-hazard-radius-source', {
        type: 'geojson',
        data: hazardGeoJSON
      });
    } else {
      map.getSource('cloudburst-hazard-radius-source').setData(hazardGeoJSON);
    }

    const isHazardVis = (!isSatellite && (activeLayer === 'convective' || isHeatmapVisible));

    if (!map.getLayer('cloudburst-hazard-radius-fill')) {
      map.addLayer({
        id: 'cloudburst-hazard-radius-fill',
        type: 'fill',
        source: 'cloudburst-hazard-radius-source',
        layout: { visibility: isHazardVis ? 'visible' : 'none' },
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.18
        }
      }, beforeId);
    } else {
      map.setLayoutProperty('cloudburst-hazard-radius-fill', 'visibility', isHazardVis ? 'visible' : 'none');
    }

    if (!map.getLayer('cloudburst-hazard-radius-line')) {
      map.addLayer({
        id: 'cloudburst-hazard-radius-line',
        type: 'line',
        source: 'cloudburst-hazard-radius-source',
        layout: { visibility: isHazardVis ? 'visible' : 'none' },
        paint: {
          'line-color': '#f43f5e',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.88
        }
      }, beforeId);
    } else {
      map.setLayoutProperty('cloudburst-hazard-radius-line', 'visibility', isHazardVis ? 'visible' : 'none');
    }
  } else {
    if (map.getLayer('cloudburst-hazard-radius-fill')) {
      map.setLayoutProperty('cloudburst-hazard-radius-fill', 'visibility', 'none');
    }
    if (map.getLayer('cloudburst-hazard-radius-line')) {
      map.setLayoutProperty('cloudburst-hazard-radius-line', 'visibility', 'none');
    }
  }

  // 6.5 Strictly Live Real-Time Doppler Weather Radar (DWR) Layers
  const isRadar = (!isSatellite && activeLayer === 'precip');

  // A. Clean up any legacy simulated plume or dark basemap rasters
  ['ventusky-radar-plume-layer', 'radar-dark-base-layer', 'radar-dark-ref-layer', 'radar-echo-purple', 'radar-echo-red', 'radar-echo-orange', 'radar-echo-yellow', 'radar-echo-green', 'radar-echo-cyan', 'radar-echo-blue', 'radar-disks-fill', 'radar-disks-stroke'].forEach((id) => {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  if (map.getSource('ventusky-radar-plume-source')) {
    map.removeSource('ventusky-radar-plume-source');
  }
  if (map.getSource('esri-dark-gray-base')) {
    map.removeSource('esri-dark-gray-base');
  }
  if (map.getSource('esri-dark-gray-ref')) {
    map.removeSource('esri-dark-gray-ref');
  }
  if (map.getSource('radar-echoes-source')) {
    map.removeSource('radar-echoes-source');
  }
  if (map.getSource('radar-disks-source')) {
    map.removeSource('radar-disks-source');
  }

  // C. Live RainViewer Doppler Radar Tiles (High-Definition Smooth Raster)
  if (radarTimestampPath) {
    // 512px Retina tiles, Dark Sky color scheme 8, smooth blur option 1_1
    const dopplerTileUrl = `https://tilecache.rainviewer.com${radarTimestampPath}/512/{z}/{x}/{y}/8/1_1.png`;

    // Invalidate existing source if missing maxzoom: 7 or using old 256px resolution
    const existingSource = map.getSource('doppler-radar-source');
    if (existingSource && (existingSource.maxzoom !== 7 || existingSource.tileSize !== 512 || !existingSource.tiles?.includes(dopplerTileUrl))) {
      if (map.getLayer('doppler-radar-layer')) {
        map.removeLayer('doppler-radar-layer');
      }
      map.removeSource('doppler-radar-source');
    }

    if (!map.getSource('doppler-radar-source')) {
      map.addSource('doppler-radar-source', {
        type: 'raster',
        tiles: [dopplerTileUrl],
        tileSize: 512,
        minzoom: 0,
        maxzoom: 7, // RainViewer supports up to zoom 7. Setting maxzoom: 7 causes MapLibre to automatically overzoom smoothly with GPU bilinear filtering
        attribution: '&copy; RainViewer.com'
      });
    }
    if (!map.getLayer('doppler-radar-layer')) {
      map.addLayer({
        id: 'doppler-radar-layer',
        type: 'raster',
        source: 'doppler-radar-source',
        layout: { visibility: isRadar ? 'visible' : 'none' },
        paint: {
          'raster-opacity': 0.88,
          'raster-resampling': 'linear',
          'raster-fade-duration': 200
        }
      }, beforeId);
    } else {
      map.setLayoutProperty('doppler-radar-layer', 'visibility', isRadar ? 'visible' : 'none');
    }
  }

  // E. Real-Time Lightning Strikes (Blitzortung)
  if (!map.getSource('lightning-strikes-source')) {
    map.addSource('lightning-strikes-source', {
      type: 'geojson',
      data: LIGHTNING_STRIKES_GEOJSON
    });
  }
  if (!map.getLayer('lightning-strikes-glow')) {
    map.addLayer({
      id: 'lightning-strikes-glow',
      type: 'circle',
      source: 'lightning-strikes-source',
      layout: { visibility: isRadar ? 'visible' : 'none' },
      paint: {
        'circle-radius': 14,
        'circle-color': '#facc15',
        'circle-opacity': 0.35,
        'circle-blur': 0.8
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('lightning-strikes-glow', 'visibility', isRadar ? 'visible' : 'none');
  }
  if (!map.getLayer('lightning-strikes-core')) {
    map.addLayer({
      id: 'lightning-strikes-core',
      type: 'circle',
      source: 'lightning-strikes-source',
      layout: { visibility: isRadar ? 'visible' : 'none' },
      paint: {
        'circle-radius': 3.5,
        'circle-color': '#ffffff',
        'circle-stroke-color': '#eab308',
        'circle-stroke-width': 1.5
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('lightning-strikes-core', 'visibility', isRadar ? 'visible' : 'none');
  }

  // 7. Refresh place label typography
  applyMapLabelsTheme(map, isSatellite);
}

// Clean, high-performance MapLibre GL JS Map Component paired with OpenFreeMap & Built-in Heatmap
export default function CloudburstMap({
  stations = STATIONS_NETWORK,
  selectedStation,
  onSelectStation,
  threatData,
  riskPercent = 92,
  currentTimeStr = "14:00",
  userLocation = null,
  activeLayer = 'temp',
  onChangeActiveLayer,
  is3D = false,
  onToggle3D,
  mapView = 'liberty', // 'liberty' | 'positron' | 'bright' | 'satellite'
  onToggleMapView,
  isHomeView = false,
  isAnalyticsOpen = false,
  showParticles = true,
  onToggleParticles,
  windParticleMode = 'normal',
  onWindParticleModeChange,
  showTemperature = true,
  tempUnit = 'C',
  humidity = 90,
  pressureDrop = 30,
  temperature = 18,
  windSpeed = 45,
  tcwv = 52,
  cloudburstEvent = null,
  onFocusEpicenter = null
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const cycloneMarkersRef = useRef([]);
  const cloudburstMarkerRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Synchronized ref for wind particle mode ('off' | 'normal' | 'strong' | 'soft' | 'dark' | 'fast')
  const windModeRef = useRef(windParticleMode);
  windModeRef.current = windParticleMode;

  // Active weather overlay layer ('temp' | 'precip' | 'wind' | 'pressure' | 'convective' | 'none')
  const [selectedWeatherLayer, setSelectedWeatherLayer] = useState(activeLayer || 'temp');

  useEffect(() => {
    if (activeLayer) {
      setSelectedWeatherLayer(activeLayer);
    }
  }, [activeLayer]);

  const handleSelectWeatherLayer = useCallback((layerKey) => {
    const next = selectedWeatherLayer === layerKey ? 'none' : layerKey;
    setSelectedWeatherLayer(next);
    if (onChangeActiveLayer) {
      onChangeActiveLayer(next);
    }
  }, [selectedWeatherLayer, onChangeActiveLayer]);

  // Synchronized ref for 2D vs 3D projection to prevent stale closures in event handlers
  const is3DRef = useRef(is3D);
  is3DRef.current = is3D;

  const mapViewRef = useRef(mapView);
  mapViewRef.current = mapView;

  // Dynamic map scale bar state (Metric vs Imperial)
  const [scaleUnit, setScaleUnit] = useState('metric');
  const [scaleInfo, setScaleInfo] = useState({ widthPx: 64, label: '200 km' });
  const scaleUnitRef = useRef(scaleUnit);
  scaleUnitRef.current = scaleUnit;

  // Selected OpenFreeMap base style ('positron' | 'liberty' | 'bright')
  const [selectedOpenFreeMapStyle, setSelectedOpenFreeMapStyle] = useState(
    ['positron', 'bright', 'liberty'].includes(mapView) ? mapView : 'positron'
  );


  // Interactive coordinate inspector probe
  const [probe, setProbe] = useState(null);
  const [probeScreenPos, setProbeScreenPos] = useState({ x: 0, y: 0 });
  const [isProbeVisible, setIsProbeVisible] = useState(false);
  const probeRef = useRef(null);
  const probeScreenPosRef = useRef({ x: 0, y: 0 });
  const isProbeVisibleRef = useRef(false);
  probeRef.current = probe;
  probeScreenPosRef.current = probeScreenPos;
  isProbeVisibleRef.current = isProbeVisible;
  const mouseMoveRafRef = useRef(null);

  // Update probe inspector (hoisted early to avoid TDZ reference errors)
  const updateProbeAtCoords = useCallback((lng, lat) => {
    const t = getLocalTemperature(lng, lat);
    const w = getLocalWindSpeed(lng, lat);
    const precip = getLocalPrecipitation(lng, lat, stations);
    const dbz = getLocalRadarDbz(lng, lat);
    const pressure = getLocalPressure(lng, lat);
    const convectiveRisk = getLocalConvectiveRisk(lng, lat, stations, threatData);
    const name = getSectorName(lng, lat);

    setProbe({
      lon: lng,
      lat,
      temp: t,
      wind: w,
      precip,
      dbz,
      pressure,
      convectiveRisk,
      name
    });
    if (mapRef.current) {
      try {
        const pt = mapRef.current.project([lng, lat]);
        setProbeScreenPos({ x: pt.x, y: pt.y });
        probeScreenPosRef.current = { x: pt.x, y: pt.y };
      } catch (e) {}
    }
    setIsProbeVisible(true);
    isProbeVisibleRef.current = true;
  }, [stations, threatData]);

  // Live RainViewer real-time Doppler radar timestamp path & time
  const [radarTimestampPath, setRadarTimestampPath] = useState(null);
  const [radarTimestampTime, setRadarTimestampTime] = useState(null);
  // Default pin centered on Bay of Bengal storm eye matching user screenshot (17°03'N 88°20'E)
  const [pinnedCoords, setPinnedCoords] = useState([88.33, 17.05]);
  const [pinnedScreenPos, setPinnedScreenPos] = useState({ x: 0, y: 0 });

  // Fetch strictly live Doppler Radar timestamp from RainViewer Public API with 10-minute auto-refresh
  useEffect(() => {
    let isMounted = true;
    const fetchRadarTimestamp = () => {
      fetch("https://api.rainviewer.com/public/weather-maps.json")
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          const past = data?.radar?.past;
          if (past && past.length > 0) {
            const latest = past[past.length - 1];
            setRadarTimestampPath(latest.path);
            if (latest.time) {
              const d = new Date(latest.time * 1000);
              setRadarTimestampTime(d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
            }
          }
        })
        .catch(() => {});
    };

    fetchRadarTimestamp();
    // Strictly live 10-minute polling cycle
    const pollInterval = setInterval(fetchRadarTimestamp, 10 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  // Streamline particle buffers optimized for 120 FPS high-refresh monitors (up to 4200 particles)
  const MAX_PARTICLES = 4200;
  const particlesRef = useRef({
    x: new Float32Array(MAX_PARTICLES),
    y: new Float32Array(MAX_PARTICLES),
    prevX: new Float32Array(MAX_PARTICLES),
    prevY: new Float32Array(MAX_PARTICLES),
    age: new Int16Array(MAX_PARTICLES),
    maxAge: new Int16Array(MAX_PARTICLES),
    speed: new Float32Array(MAX_PARTICLES)
  });

  // Dynamically compute the GeoJSON FeatureCollection for MapLibre's built-in heatmap renderer
  const heatmapGeoJSON = useMemo(() => {
    return generateCloudburstHeatmapGeoJSON({
      stations,
      selectedStation,
      threatData,
      humidity,
      pressureDrop
    });
  }, [stations, selectedStation, threatData, humidity, pressureDrop]);

  // Flat 2D Mercator Projection (Globe and 3D tilt completely removed)
  const apply3DState = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (map.isStyleLoaded()) {
        map.setProjection({ type: 'mercator' });
      }
    } catch (err) {}
    map.setMaxPitch(0);
    map.setPitch(0);
    map.setBearing(0);
  }, []);

  // Expose global projection switcher
  useEffect(() => {
    window.__burstwatch_apply3D = apply3DState;
    return () => {
      delete window.__burstwatch_apply3D;
    };
  }, [apply3DState]);

  // Render user location & cloudburst epicenter markers on MapLibre map
  const renderStationMarkers = useCallback((map) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (cloudburstMarkerRef.current) {
      cloudburstMarkerRef.current.remove();
      cloudburstMarkerRef.current = null;
    }

    if (userLocation?.lng && userLocation?.lat) {
      const userEl = document.createElement('div');
      userEl.className = 'custom-user-marker relative flex items-center justify-center cursor-pointer select-none';
      userEl.innerHTML = `
        <div class="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-lg flex items-center justify-center">
          <div class="w-1 h-1 rounded-full bg-slate-950"></div>
        </div>
      `;

      userEl.addEventListener('click', (e) => {
        e.stopPropagation();
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 10.0,
          speed: 1.2
        });
      });

      const userMarker = new maplibregl.Marker({ element: userEl })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
      markersRef.current.push(userMarker);
    }

    // Epicenter Pulsing Hazard Beacon
    if (cloudburstEvent?.coordinates) {
      const [lon, lat] = cloudburstEvent.coordinates;
      const epicenterEl = document.createElement('div');
      epicenterEl.className = 'custom-cloudburst-epicenter relative flex items-center justify-center cursor-pointer select-none group pointer-events-auto';
      epicenterEl.title = `${cloudburstEvent.title} — Predicted Rain Rate: ${cloudburstEvent.metrics?.predictedRainRateMmh || 128.5} mm/h (Click to Focus)`;

      epicenterEl.innerHTML = `
        <div class="relative flex items-center justify-center pointer-events-auto">
          <!-- Outer Pulsating Shockwave 1 -->
          <span class="absolute w-20 h-20 rounded-full bg-red-600/35 animate-ping pointer-events-none" style="animation-duration: 2.2s;"></span>
          <!-- Outer Pulsating Shockwave 2 -->
          <span class="absolute w-36 h-36 rounded-full border border-red-500/40 animate-ping pointer-events-none" style="animation-duration: 3.5s;"></span>
          <!-- Reticle boundary ring -->
          <span class="absolute w-12 h-12 rounded-full border-2 border-dashed border-rose-400 animate-spin pointer-events-none" style="animation-duration: 12s;"></span>
          <!-- Core Mission Control Badge -->
          <div class="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-mono text-[11px] font-black shadow-[0_0_24px_rgba(239,68,68,0.9)] border-2 border-white scale-100 group-hover:scale-110 transition-transform">
            <span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
            <span class="tracking-wide uppercase">⚡ ${cloudburstEvent.metrics?.riskPercent ? `${cloudburstEvent.metrics.riskPercent}% RISK • ` : ''}${cloudburstEvent.metrics?.predictedRainRateMmh || 128.5} mm/h</span>
          </div>
        </div>
      `;

      epicenterEl.addEventListener('click', (e) => {
        e.stopPropagation();
        map.flyTo({
          center: [lon, lat],
          zoom: 10.5,
          pitch: is3DRef.current ? 58 : 30,
          bearing: 15,
          speed: 1.2
        });
        updateProbeAtCoords(lon, lat);
        if (onFocusEpicenter) {
          onFocusEpicenter(cloudburstEvent);
        }
      });

      const cbMarker = new maplibregl.Marker({ element: epicenterEl })
        .setLngLat([lon, lat])
        .addTo(map);

      cloudburstMarkerRef.current = cbMarker;
    }
  }, [userLocation, cloudburstEvent, updateProbeAtCoords, onFocusEpicenter]);

  // Initialize MapLibre GL JS with OpenFreeMap vector basemap
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialStyleUrl = OPENFREEMAP_STYLES[selectedOpenFreeMapStyle] || OPENFREEMAP_STYLES.positron;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: initialStyleUrl,
      center: [78.96, 22.50],
      zoom: 4.2,
      minZoom: 2.8,
      maxZoom: 17,
      maxPitch: 0,
      pitch: 0,
      antialias: true,
      renderWorldCopies: true,
      attributionControl: false,
      preserveDrawingBuffer: false,
      fadeDuration: 0
    });

    mapRef.current = map;
    window.map = map;

    const onStyleReady = () => {
      const isSat = mapViewRef.current === 'satellite';
      const isHeatmapVis = showTemperature && !isSat;

      applyMapLayersAndHeatmap(map, isSat, selectedWeatherLayer, isHeatmapVis, heatmapGeoJSON, radarTimestampPath, cloudburstEvent);
      apply3DState(is3DRef.current, false);
      renderStationMarkers(map);
    };

    map.on('load', () => {
      onStyleReady();



      // Dynamic reactive map scale listener
      const handleScaleUpdate = () => {
        const nextScale = calculateMapScale(map, 76, scaleUnitRef.current);
        setScaleInfo(nextScale);
      };

      map.on('zoom', handleScaleUpdate);
      map.on('move', handleScaleUpdate);
      map.on('resize', handleScaleUpdate);
      handleScaleUpdate();

      // Real-time cursor hover & coordinate tracker on map canvas
      map.on('mousemove', (e) => {
        const { x, y } = e.point;
        const { lng, lat } = e.lngLat;
        const t = getLocalTemperature(lng, lat);
        const w = getLocalWindSpeed(lng, lat);
        const precip = getLocalPrecipitation(lng, lat, stations);
        const dbz = getLocalRadarDbz(lng, lat);
        const pressure = getLocalPressure(lng, lat);
        const convectiveRisk = getLocalConvectiveRisk(lng, lat, stations, threatData);
        const name = getSectorName(lng, lat);

        probeScreenPosRef.current = { x, y };
        isProbeVisibleRef.current = true;

        setProbe({
          lon: lng,
          lat,
          temp: t,
          wind: w,
          precip,
          dbz,
          pressure,
          convectiveRisk,
          name
        });
        setProbeScreenPos({ x, y });
        setIsProbeVisible(true);
      });

      // Pin location click listener in radar mode
      map.on('click', (e) => {
        setPinnedCoords([e.lngLat.lng, e.lngLat.lat]);
      });

      // Initialize probe at center of map
      try {
        const center = map.getCenter();
        const centerPt = map.project(center);
        setProbe({
          lon: center.lng,
          lat: center.lat,
          temp: getLocalTemperature(center.lng, center.lat),
          wind: getLocalWindSpeed(center.lng, center.lat),
          precip: getLocalPrecipitation(center.lng, center.lat, stations),
          dbz: getLocalRadarDbz(center.lng, center.lat),
          pressure: getLocalPressure(center.lng, center.lat),
          convectiveRisk: getLocalConvectiveRisk(center.lng, center.lat, stations, threatData),
          name: getSectorName(center.lng, center.lat)
        });
        setProbeScreenPos({ x: centerPt.x, y: centerPt.y });
        setIsProbeVisible(true);
        probeScreenPosRef.current = { x: centerPt.x, y: centerPt.y };
        isProbeVisibleRef.current = true;
      } catch (err) {}
    });

    map.on('style.load', onStyleReady);

    return () => {
      markersRef.current.forEach(m => m.remove());
      cycloneMarkersRef.current.forEach(m => m.remove());
      if (cloudburstMarkerRef.current) {
        cloudburstMarkerRef.current.remove();
        cloudburstMarkerRef.current = null;
      }
      map.remove();
    };
  }, []);

  // Reactively update Built-in Heatmap, WeatherAPI, Cloudburst Hazard & Doppler Radar Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const isSat = mapView === 'satellite';
    const isHeatmapVis = showTemperature && !isSat;

    applyMapLayersAndHeatmap(map, isSat, selectedWeatherLayer, isHeatmapVis, heatmapGeoJSON, radarTimestampPath, cloudburstEvent);
  }, [heatmapGeoJSON, showTemperature, mapView, selectedWeatherLayer, radarTimestampPath, cloudburstEvent]);

  // Handle switching OpenFreeMap Vector Styles (Liberty, Positron, Bright)
  const handleSwitchOpenFreeMapStyle = useCallback((styleKey) => {
    const map = mapRef.current;
    if (!map) return;

    const targetUrl = OPENFREEMAP_STYLES[styleKey];
    if (!targetUrl) return;

    setSelectedOpenFreeMapStyle(styleKey);
    if (onToggleMapView) onToggleMapView(styleKey);

    map.setStyle(targetUrl);
  }, [onToggleMapView]);

  // Reactively recompute scale when scaleUnit toggles
  useEffect(() => {
    if (mapRef.current) {
      setScaleInfo(calculateMapScale(mapRef.current, 76, scaleUnit));
    }
  }, [scaleUnit]);

  // Synchronize 3D vs 2D Projection, Pitch and Bearing
  useEffect(() => {
    apply3DState(is3D, true);
  }, [is3D, apply3DState]);

  // Ventusky-Style Fluid Atmospheric Wind Streamline Particle Engine (Optimized for 120 FPS)
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const isOff = !showParticles || windParticleMode === 'off';
    if (isOff) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const p = particlesRef.current;
    const count = MAX_PARTICLES;

    const resize = () => {
      const rect = map.getCanvas().getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;

        for (let i = 0; i < count; i++) {
          const rx = Math.random() * canvas.width;
          const ry = Math.random() * canvas.height;
          p.x[i] = rx;
          p.y[i] = ry;
          p.prevX[i] = rx;
          p.prevY[i] = ry;
          p.age[i] = Math.floor(Math.random() * 85);
          p.maxAge[i] = 70 + Math.floor(Math.random() * 85);
          p.speed[i] = 0.90 + Math.random() * 1.10;
        }
      }
    };

    resize();
    map.on('resize', resize);

    let west = 0, east = 0, north = 0, south = 0, dLng = 1, dLat = 1;
    let zoom = 2;
    let globeRadiusSq = Infinity;
    let globeCenterX = canvas.width * 0.5;
    let globeCenterY = canvas.height * 0.5;

    const updateCameraCache = () => {
      try {
        const bounds = map.getBounds();
        west = bounds.getWest();
        east = bounds.getEast();
        north = bounds.getNorth();
        south = bounds.getSouth();
        dLng = east - west;
        dLat = north - south;
        zoom = map.getZoom();

        const w = canvas.width;
        const h = canvas.height;
        globeRadiusSq = Infinity;
      } catch (e) {}
    };

    updateCameraCache();
    map.on('move', updateCameraCache);
    map.on('zoom', updateCameraCache);

    const onZoomStart = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    map.on('zoomstart', onZoomStart);

    let isRunning = true;

    const render = () => {
      const mode = windModeRef.current || 'normal';
      if (!isRunning || !showParticles || mode === 'off') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Dynamic mode parameters matching the 4 reference pictures exactly
      // 1. Pic 1 (Normal): Soft white glowing oblong dashes, moderate spacing, length ~18-24px
      let activeCount = 2200;
      let speedMult = 0.38; // Gently decreased slightly from 0.52 for extra calm, silky wind drift
      let fadeRate = 0.046; // Tuned persistence so streaks remain graceful, soft, and continuous
      let strokeFine = 'rgba(240, 248, 255, 0.45)';
      let widthFine = 1.8;
      let strokeMid = 'rgba(255, 255, 255, 0.78)';
      let widthMid = 2.3;
      let strokeStrong = 'rgba(255, 255, 255, 0.98)';
      let widthStrong = 2.8;

      if (mode === 'strong') {
        // 2. Pic 2 (Strong): Ultra-dense, fine, sharp, brilliant white threads
        activeCount = 4000;
        speedMult = 1.22;
        fadeRate = 0.048; // long persistence creating dense silk weave
        strokeFine = 'rgba(245, 250, 255, 0.60)';
        widthFine = 0.95;
        strokeMid = 'rgba(255, 255, 255, 0.90)';
        widthMid = 1.25;
        strokeStrong = 'rgba(255, 255, 255, 1.0)';
        widthStrong = 1.55;
      } else if (mode === 'dark') {
        // 3. Pic 3 (Dark): Discrete charcoal/black dashes of moderate density
        activeCount = 2200;
        speedMult = 0.38;
        fadeRate = 0.044;
        strokeFine = 'rgba(50, 50, 60, 0.50)';
        widthFine = 1.6;
        strokeMid = 'rgba(20, 20, 28, 0.82)';
        widthMid = 2.1;
        strokeStrong = 'rgba(5, 5, 12, 0.98)';
        widthStrong = 2.6;
      } else if (mode === 'fast') {
        // 4. Pic 4 (Fast-motion): Dense, striated black velocity lines with smoothly dialed-down speed
        activeCount = 3800;
        speedMult = 1.38;
        fadeRate = 0.058;
        strokeFine = 'rgba(50, 50, 60, 0.45)';
        widthFine = 0.95;
        strokeMid = 'rgba(22, 22, 30, 0.82)';
        widthMid = 1.25;
        strokeStrong = 'rgba(2, 2, 8, 0.98)';
        widthStrong = 1.60;
      }

      // Authentic Ventusky Ghost Trail Persistence
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeRate})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const width = canvas.width;
      const height = canvas.height;
      const invW = 1 / Math.max(1, width);
      const invH = 1 / Math.max(1, height);
      const is3DCurrent = is3DRef.current;

      const tierFine = [];   // delicate background streamlines
      const tierMid = [];    // standard active streamlines
      const tierStrong = []; // brilliant, luminous streaks (matching Ventusky reference)

      for (let i = 0; i < activeCount; i++) {
        const currX = p.x[i];
        const currY = p.y[i];



        // --- 2nd-Order Runge-Kutta (RK2 Midpoint) Integration with Strictly Bounded Screen Micro-Steps ---
        const lng0 = west + currX * invW * dLng;
        const lat0 = north - currY * invH * dLat;
        const k1 = getWindVector(lng0, lat0);
        const mag1 = Math.sqrt(k1.u * k1.u + k1.v * k1.v);

        // Screen displacement strictly bounded between 1.3 and 3.2 pixels per frame
        // This eliminates coarse polygonal chords and guarantees smooth continuous curvature
        const speedPx = (1.2 + Math.min(2.0, mag1 * 0.32)) * p.speed[i] * speedMult;
        const invMag1 = 1 / (mag1 + 0.001);

        // Midpoint predictor (half step)
        const midX = currX + (k1.u * invMag1) * (speedPx * 0.5);
        const midY = currY - (k1.v * invMag1) * (speedPx * 0.5);
        const lngMid = west + midX * invW * dLng;
        const latMid = north - midY * invH * dLat;

        // Sample vector at midpoint
        const k2 = getWindVector(lngMid, latMid);
        const mag2 = Math.sqrt(k2.u * k2.u + k2.v * k2.v);
        const invMag2 = 1 / (mag2 + 0.001);

        // Corrector: advance particle from currX, currY to nextX, nextY along midpoint tangent
        const nextX = currX + (k2.u * invMag2) * speedPx;
        const nextY = currY - (k2.v * invMag2) * speedPx;

        const lifeRatio = p.age[i] / p.maxAge[i];
        const alpha = Math.sin(lifeRatio * Math.PI);

        // Draw ONE continuous micro-segment per frame connecting with historical ghost trail
        if (p.age[i] > 1 && alpha > 0.04) {
          let targetTier = tierFine;
          if (mag2 >= 5.2 || alpha > 0.82) {
            targetTier = tierStrong;
          } else if (mag2 >= 2.6 || alpha > 0.48) {
            targetTier = tierMid;
          }
          targetTier.push(currX, currY, nextX, nextY);
        }

        p.prevX[i] = currX;
        p.prevY[i] = currY;
        p.x[i] = nextX;
        p.y[i] = nextY;
        p.age[i]++;

        if (
          nextX < -20 || nextX > width + 20 ||
          nextY < -20 || nextY > height + 20 ||
          p.age[i] >= p.maxAge[i]
        ) {
          p.x[i] = Math.random() * width;
          p.y[i] = Math.random() * height;
          p.prevX[i] = p.x[i];
          p.prevY[i] = p.y[i];
          p.age[i] = 0;
          p.maxAge[i] = (mode === 'fast' ? 45 : 75) + Math.floor(Math.random() * (mode === 'fast' ? 45 : 85));
          p.speed[i] = 0.90 + Math.random() * 0.40;
        }
      }

      // 1. Delicate background streamlines (translucent silk)
      if (tierFine.length > 0) {
        ctx.beginPath();
        ctx.lineWidth = widthFine;
        ctx.strokeStyle = strokeFine;
        for (let j = 0; j < tierFine.length; j += 4) {
          ctx.moveTo(tierFine[j], tierFine[j + 1]);
          ctx.lineTo(tierFine[j + 2], tierFine[j + 3]);
        }
        ctx.stroke();
      }

      // 2. Medium active streamlines (clear crisp white)
      if (tierMid.length > 0) {
        ctx.beginPath();
        ctx.lineWidth = widthMid;
        ctx.strokeStyle = strokeMid;
        for (let j = 0; j < tierMid.length; j += 4) {
          ctx.moveTo(tierMid[j], tierMid[j + 1]);
          ctx.lineTo(tierMid[j + 2], tierMid[j + 3]);
        }
        ctx.stroke();
      }

      // 3. Crisp luminous foreground streaks (matching Ventusky reference)
      if (tierStrong.length > 0) {
        ctx.beginPath();
        ctx.lineWidth = widthStrong;
        ctx.strokeStyle = strokeStrong;
        for (let j = 0; j < tierStrong.length; j += 4) {
          ctx.moveTo(tierStrong[j], tierStrong[j + 1]);
          ctx.lineTo(tierStrong[j + 2], tierStrong[j + 3]);
        }
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      map.off('resize', resize);
      map.off('zoomstart', onZoomStart);
      map.off('move', updateCameraCache);
      map.off('zoom', updateCameraCache);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [showParticles, windParticleMode]);


  // Real-time hover cursor coordinate, temperature & windspeed probe tracking
  const handleMouseMove = useCallback((e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;

    const map = mapRef.current;
    if (!map) return;
    const container = mapContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      return;
    }

    try {
      const lngLat = map.unproject([x, y]);
      const lng = lngLat.lng;
      const lat = lngLat.lat;

      const t = getLocalTemperature(lng, lat);
      const w = getLocalWindSpeed(lng, lat);
      const precip = getLocalPrecipitation(lng, lat, stations);
      const dbz = getLocalRadarDbz(lng, lat);
      const pressure = getLocalPressure(lng, lat);
      const convectiveRisk = getLocalConvectiveRisk(lng, lat, stations, threatData);
      const name = getSectorName(lng, lat);

      probeScreenPosRef.current = { x, y };
      isProbeVisibleRef.current = true;

      setProbe({
        lon: lng,
        lat,
        temp: t,
        wind: w,
        precip,
        dbz,
        pressure,
        convectiveRisk,
        name
      });
      setProbeScreenPos({ x, y });
      setIsProbeVisible(true);
    } catch (err) {}
  }, [stations, threatData]);

  // Update probe box when user scrolls mouse wheel over the map
  const handleWheel = useCallback((e) => {
    const container = mapContainerRef.current;
    const map = mapRef.current;
    if (!container || !map) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      probeScreenPosRef.current = { x, y };
      isProbeVisibleRef.current = true;
      setProbeScreenPos({ x, y });
      setIsProbeVisible(true);

      try {
        const lngLat = map.unproject([x, y]);
        setProbe({
          lon: lngLat.lng,
          lat: lngLat.lat,
          temp: getLocalTemperature(lngLat.lng, lngLat.lat),
          wind: getLocalWindSpeed(lngLat.lng, lngLat.lat),
          precip: getLocalPrecipitation(lngLat.lng, lngLat.lat, stations),
          dbz: getLocalRadarDbz(lngLat.lng, lngLat.lat),
          pressure: getLocalPressure(lngLat.lng, lngLat.lat),
          convectiveRisk: getLocalConvectiveRisk(lngLat.lng, lngLat.lat, stations, threatData),
          name: getSectorName(lngLat.lng, lngLat.lat)
        });
      } catch (err) {}
    }
  }, [stations, threatData]);

  const handleMouseLeave = useCallback(() => {
    // Keep visible so probe box doesn't flicker on fast cursor movement
  }, []);

  // Active Tropical Cyclone Systems
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    cycloneMarkersRef.current.forEach(m => m.remove());
    cycloneMarkersRef.current = [];

    if (!showTemperature) return;

    ACTIVE_CYCLONES.forEach(cyclone => {
      const el = document.createElement('div');
      el.className = 'custom-cyclone-marker flex items-center gap-1.5 apple-liquid-glass px-2.5 py-1 rounded-full shadow-2xl cursor-pointer select-none transition-transform hover:scale-110 active:scale-95 border border-white/20 pointer-events-auto';
      el.title = `${cyclone.name} (${cyclone.status}) — Wind: ${cyclone.windKmh} km/h, Pressure: ${cyclone.pressureHpa} hPa`;
      el.innerHTML = `
        <span class="w-4 h-4 flex items-center justify-center animate-spin text-rose-400" style="animation-duration: 3.5s;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3.5 h-3.5 text-rose-400">
            <path d="M12 2a10 10 0 0 1 7.07 17.07l-2.12-2.12A7 7 0 0 0 12 5v-3z"/>
            <path d="M12 22a10 10 0 0 1-7.07-17.07l2.12 2.12A7 7 0 0 0 12 19v3z"/>
          </svg>
        </span>
        <span class="text-[11px] font-bold text-white tracking-wide">${cyclone.name}</span>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        map.flyTo({
          center: [cyclone.lon, cyclone.lat],
          zoom: 5.5,
          speed: 1.2
        });
        updateProbeAtCoords(cyclone.lon, cyclone.lat);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([cyclone.lon, cyclone.lat])
        .addTo(map);

      cycloneMarkersRef.current.push(marker);
    });

    return () => {
      cycloneMarkersRef.current.forEach(m => m.remove());
      cycloneMarkersRef.current = [];
    };
  }, [showTemperature, updateProbeAtCoords]);

  // Update probe coordinates on map pan/zoom/scroll
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMapChange = () => {
      const pos = probeScreenPosRef.current;
      if (!isProbeVisibleRef.current || !pos || pos.x <= 0) return;
      try {
        const lngLat = map.unproject([pos.x, pos.y]);
        const lng = lngLat.lng;
        const lat = lngLat.lat;

        const t = getLocalTemperature(lng, lat);
        const w = getLocalWindSpeed(lng, lat);
        const name = getSectorName(lng, lat);

        setProbe({
          lon: lng,
          lat,
          temp: t,
          wind: w,
          name
        });
      } catch (err) {}
    };

    map.on('move', onMapChange);
    map.on('zoom', onMapChange);
    return () => {
      map.off('move', onMapChange);
      map.off('zoom', onMapChange);
    };
  }, []);

  // Click on map to inspect coordinate
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMapClick = (e) => {
      const { lng, lat } = e.lngLat;
      const { x, y } = e.point;
      updateProbeAtCoords(lng, lat);
      setProbeScreenPos({ x, y });
      setIsProbeVisible(true);
      const sectorName = getSectorName(lng, lat);
      const isIndia = isIndiaSector(lng, lat);
      if (onSelectStation) {
        onSelectStation({
          id: `coord-${lng.toFixed(2)}-${lat.toFixed(2)}`,
          name: sectorName,
          region: isIndia ? 'Indian Sector' : 'Global Sector',
          state: isIndia ? 'India' : 'Global',
          country: isIndia ? 'India' : 'Global',
          lat,
          lon: lng,
          elevation: isIndia && lat > 28 ? 1800 : 250,
          isIndia,
          isGlobal: !isIndia,
          humidity: Math.round(Math.max(30, Math.min(95, 75 + Math.sin(lat * 0.1) * 15))),
          pressureDrop: isIndia ? 28 : 12,
          temp: getLocalTemperature(lng, lat),
          windSpeed: getLocalWindSpeed(lng, lat),
          rainfallRate: 15.0
        });
      }
    };

    map.on('click', onMapClick);
    return () => map.off('click', onMapClick);
  }, [updateProbeAtCoords, onSelectStation]);

  // Update station and user markers when userLocation updates
  useEffect(() => {
    if (mapRef.current) {
      renderStationMarkers(mapRef.current);
    }
  }, [userLocation, cloudburstEvent, renderStationMarkers]);

  // Track previous station ID
  const prevStationIdRef = useRef(selectedStation?.id);

  // Fly to selected station only when explicitly changed by user interaction
  useEffect(() => {
    if (prevStationIdRef.current === selectedStation?.id) {
      return;
    }
    prevStationIdRef.current = selectedStation?.id;

    if (mapRef.current && selectedStation?.lon && selectedStation?.lat) {
      mapRef.current.flyTo({
        center: [selectedStation.lon, selectedStation.lat],
        zoom: selectedStation.elevation > 1500 ? 9.2 : 8.2,
        pitch: is3D ? 58 : 0,
        speed: 1.3,
        curve: 1.4
      });
      updateProbeAtCoords(selectedStation.lon, selectedStation.lat);
      renderStationMarkers(mapRef.current);
    }
  }, [selectedStation, is3D, updateProbeAtCoords, renderStationMarkers]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetCamera = () => {
    mapRef.current?.flyTo({
      center: [78.96, 22.50],
      zoom: 4.2,
      pitch: 0,
      bearing: 0,
      speed: 1.2
    });
  };

  return (
    <div 
      className="relative w-full h-full overflow-hidden bg-[#02040a] select-none"
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
    >


      {/* 1. MapLibre GL JS WebGL Canvas Container (Paired with OpenFreeMap vector styles & built-in heatmap) */}
      <div 
        ref={mapContainerRef} 
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-full z-[1]" 
      />

      {/* 2. Streamline particles (hardware-composited on top of heatmap at 120 FPS) */}
      <canvas
        ref={particleCanvasRef}
        className="pointer-events-none absolute inset-0 z-[10] w-full h-full transition-opacity duration-150"
        style={{
          opacity: (showParticles && windParticleMode !== 'off') ? 1 : 0,
          pointerEvents: 'none'
        }}
      />

      {/* 2.5 Weather Overlay Layer Floating Pill Bar */}
      {!isHomeView && (
        <div className={`absolute bottom-20 z-20 flex items-center gap-1 apple-liquid-glass px-2.5 py-1.5 rounded-full shadow-2xl pointer-events-auto border border-white/20 select-none transition-all duration-300 max-w-[calc(100vw-32px)] overflow-x-auto scrollbar-none ${isAnalyticsOpen ? 'right-[420px]' : 'right-16'}`}>
          <span className="px-1 text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1 select-none shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Weather:</span>
          </span>

          {[
            { id: 'temp', label: 'Temperature', icon: Thermometer },
            { id: 'convective', label: 'Cloudburst', icon: Zap },
            { id: 'precip', label: 'Rain Radar', icon: CloudRain },
            { id: 'wind', label: 'Wind Speed', icon: Wind },
            { id: 'pressure', label: 'Pressure', icon: Compass },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = selectedWeatherLayer === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectWeatherLayer(item.id)}
                title={`Toggle ${item.label} Overlay`}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'apple-liquid-glass-amber text-amber-200 border border-amber-400/50 shadow-md scale-105'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {selectedWeatherLayer !== 'none' && (
            <button
              type="button"
              onClick={() => handleSelectWeatherLayer('none')}
              title="Hide all weather overlay layers"
              className="px-2 py-0.5 text-slate-400 hover:text-white text-[10px] font-mono transition-colors cursor-pointer shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      )}




      {/* 3.9 Pinned Tooltip at 17°03'N 88°20'E (0 mi) matching user screenshot */}
      {selectedWeatherLayer === 'precip' && pinnedScreenPos.x > 0 && (
        <div 
          id="radar-pin-badge"
          className="absolute z-25 pointer-events-none select-none transition-transform duration-75"
          style={{
            left: `${pinnedScreenPos.x}px`,
            top: `${pinnedScreenPos.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="relative bg-white text-slate-900 px-3.5 py-1.5 rounded-lg shadow-2xl border border-black/15 flex flex-col items-center select-none">
            <div className="flex items-center gap-1 text-[13px] font-bold font-sans tracking-tight whitespace-nowrap">
              <MapPin className="w-3.5 h-3.5 text-blue-600 fill-blue-500 shrink-0" />
              <span>
                {(() => {
                  const lat = pinnedCoords[1] ?? 17.05;
                  const lon = pinnedCoords[0] ?? 88.33;
                  const latDeg = Math.floor(Math.abs(lat));
                  const latMin = Math.round((Math.abs(lat) - latDeg) * 60);
                  const latDir = lat >= 0 ? 'N' : 'S';
                  const lonDeg = Math.floor(Math.abs(lon));
                  const lonMin = Math.round((Math.abs(lon) - lonDeg) * 60);
                  const lonDir = lon >= 0 ? 'E' : 'W';
                  return `${latDeg}°${String(latMin).padStart(2, '0')}'${latDir} ${lonDeg}°${String(lonMin).padStart(2, '0')}'${lonDir}`;
                })()}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">0 mi</span>
            {/* Downward triangle arrow */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45 border-r border-b border-black/15" />
          </div>
        </div>
      )}

      {/* 4. Minimalist Ventusky-Style Floating Weather Badge Just Below Cursor */}
      {probe && isProbeVisible && probeScreenPos.x > 0 && (
        <div 
          className="absolute z-50 pointer-events-none select-none transition-all duration-75 ease-out"
          style={{
            left: `${Math.max(45, Math.min((window.innerWidth || 1200) - 45, probeScreenPos.x))}px`,
            top: `${probeScreenPos.y > (window.innerHeight || 800) - 50 ? probeScreenPos.y - 12 : probeScreenPos.y + 14}px`,
            transform: probeScreenPos.y > (window.innerHeight || 800) - 50 ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
          }}
        >
          <div 
            id="cursor-temp-pill"
            className="bg-white/95 backdrop-blur-md px-3.5 py-1 rounded-full shadow-lg border border-black/15 flex items-center justify-center select-none"
          >
            <span className="font-sans font-bold text-[13px] text-slate-900 tracking-tight leading-none whitespace-nowrap">
              {(() => {
                if (selectedWeatherLayer === 'precip') {
                  return `${probe.precip ?? 0} mm/h`;
                }
                if (selectedWeatherLayer === 'wind') {
                  return `${probe.wind ?? 0} km/h`;
                }
                if (selectedWeatherLayer === 'pressure') {
                  return `${probe.pressure ?? 1013} hPa`;
                }
                if (selectedWeatherLayer === 'convective') {
                  return `${probe.convectiveRisk ?? 85}% Risk`;
                }
                const val = tempUnit === 'F' ? celsiusToFahrenheit(probe.temp) : probe.temp;
                const sign = val < 0 ? '\u2212' : '';
                return `${sign}${Math.abs(val)} °${tempUnit}`;
              })()}
            </span>
          </div>
        </div>
      )}



      {/* 4.8 Bottom Left Timestamp Pill */}
      {selectedWeatherLayer === 'precip' && !isHomeView && (
        <div className="absolute bottom-16 left-4 z-20 apple-liquid-glass-pill px-3 py-1 rounded-full text-xs font-mono font-bold text-slate-100 shadow-xl border border-white/20 select-none pointer-events-auto">
          {radarTimestampTime || '3:45 AM'}
        </div>
      )}

      {/* 5. Clean Basic Map Navigation Controls */}
      {!isHomeView && (
        <div className={`absolute bottom-8 z-20 flex flex-col gap-1.5 apple-liquid-glass p-1.5 rounded-full shadow-2xl pointer-events-auto transition-all duration-300 ${isAnalyticsOpen ? 'right-[360px]' : 'right-4'}`}>
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer active:scale-95"
          >
            <Minus className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              mapRef.current?.flyTo({
                center: [78.96, 23.50],
                zoom: 4.8,
                pitch: is3D ? 58 : 0,
                bearing: is3D ? 20 : 0,
                speed: 1.2
              });
            }}
            title="Focus India / Himalayas"
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center font-bold text-xs active:scale-95"
          >
            <span>🇮🇳</span>
          </button>
        </div>
      )}

      {/* Bottom Left Dynamic Scale Indicator */}
      {!isHomeView && (
        <button
          type="button"
          onClick={() => setScaleUnit((u) => (u === 'metric' ? 'imperial' : 'metric'))}
          title={`Click to toggle units (${scaleUnit === 'metric' ? 'Metric: km' : 'Imperial: mi'})`}
          className="absolute bottom-8 left-4 z-20 flex flex-col gap-1 text-[10px] font-mono text-slate-100 apple-liquid-glass-pill px-3 py-1 rounded-full shadow-xl pointer-events-auto select-none border border-white/20 cursor-pointer hover:bg-white/20 transition-all active:scale-95"
        >
          <div className="flex items-center gap-2">
            <span
              style={{ width: `${scaleInfo.widthPx}px` }}
              className="h-1 bg-white border-l-2 border-r-2 border-white shadow-[0_0_6px_#fff] transition-all duration-75"
            />
            <span className="font-semibold whitespace-nowrap">{scaleInfo.label}</span>
          </div>
        </button>
      )}
    </div>
  );
}
