import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Plus, 
  Minus, 
  Zap, 
  Thermometer, 
  CloudRain, 
  Wind,
  Sparkles, 
  Volume2,
  VolumeX,
  X,
  MapPin,
  Loader2
} from 'lucide-react';
import { STATIONS_NETWORK } from '../data/cloudburstData';
import { getCachedMLRisk } from '../services/mlPredictionService';
import { isIndiaSector } from '../utils/geoUtils';
import { 
  celsiusToFahrenheit,
  getWindSpeedColor,
  getWindSpeedCategory,
  getTempColorHex,
  formatTemperature,
  getLiveTemperature,
  getCachedPointTemperature,
  preloadTemperatureEngine
} from '../utils/temperatureUtils';
import {
  getActiveCyclones,
  subscribeActiveCyclones,
  fetchLiveCyclones,
  computeCycloneVelocity,
  computeCyclonePrecipitation,
  computeCyclonePressureDrop,
  getSurfaceFrictionMultiplier
} from '../services/cycloneService';
import { generateCloudburstHeatmapGeoJSON } from '../utils/heatmapGeoJson';
import { WEATHER_LAYERS, getWeatherApiTileUrl, getWeatherApiTimestamp } from '../utils/weatherTiles';
import {
  getLocalRadarDbz,
  getRadarProbeInfo,
  estimateLocalRainRate,
  RADAR_COVERAGE_CENTERS
} from '../utils/radarEchoesData';
import {
  subscribeLightningStrikes,
  subscribeLightningFlashes,
  getLightningStrikesGeoJSON,
  thunderSynth
} from '../services/lightningService';
import { generateHazardRadiusGeoJSON } from '../services/cloudburstEventModel';
import WORLD_COUNTRIES_DATA from '../data/worldCountries.json';
import { WORLD_OVERVIEW_LABELS } from '../data/worldOverviewLabels';
import { HIERARCHICAL_PLACES } from '../data/hierarchicalPlaces';

const BASEMAP_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    basemap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#060d1a'
      }
    },
    {
      id: 'basemap',
      type: 'raster',
      source: 'basemap',
      paint: {
        'raster-fade-duration': 0,
        'raster-resampling': 'linear'
      }
    }
  ]
};

// MapLibre GL JS Built-in Heatmap Layer Identifiers
const HEATMAP_SOURCE_ID = 'cloudburst-heatmap-source';
const HEATMAP_LAYER_ID = 'cloudburst-heatmap-layer';
const HEATMAP_POINT_LAYER_ID = 'cloudburst-heatmap-points';

// Shortest delta longitude along spherical surface [-180, +180]
function deltaLon(lon1, lon2) {
  return ((((lon1 - lon2 + 180) % 360) + 360) % 360) - 180;
}

// Globally Continuous, Infinitely Differentiable (C^inf) Atmospheric Vector Field
// Adheres strictly to Windy/Ventusky streamline fluid flow principles:
// 1. Zero hard-threshold boundary discontinuities (C^inf smooth Gaussian decays everywhere)
// 2. Strict periodic zonal wavenumbers (eliminates any 180-degree antimeridian seam)
// 3. Shortest spherical great-circle delta-longitude wrapping (no seam kinks across meridians)
function getWindVector(lon, lat) {
  const latRad = (lat * Math.PI) / 180.0;
  const lonRad = (lon * Math.PI) / 180.0;
  const cosLat = Math.cos(latRad);
  
  let u = 0.0;
  let v = 0.0;

  // 1. Zonal Planetary Circulation (Smooth Fourier representation)
  // - Easterly Trade Winds in the Tropics (lat -30 to +30)
  // - Westerly Jet Stream in Mid-Latitudes (lat 30 to 60)
  // - Gentle Polar Easterlies at high latitudes
  u += -3.4 * Math.cos(latRad * 3.0) + 1.1 * cosLat;
  v += -0.85 * Math.sin(latRad * 2.0);

  // 2. Subtropical Anticyclonic Ocean Gyres with smooth polar tapering (zero piecewise steps)
  if (Math.abs(lat) < 80) {
    const gyreFactor = Math.cos(Math.min(1.0, Math.abs(lat) / 80.0) * (Math.PI / 2.0));
    const gyre1 = Math.sin(lonRad * 1.0 + 0.8);
    const gyre2 = Math.sin(lonRad * 2.0 + 2.4);
    v += (gyre1 + gyre2 * 0.6) * 1.1 * Math.cos(latRad * 1.2) * gyreFactor;
    u += Math.cos(latRad * 2.0) * 0.8 * gyreFactor;
  }

  // 3. Divergence-Free Streamfunction Waves with integer zonal wavenumbers (strictly periodic)
  // Planetary Rossby Wave 1 (m=3, n=2)
  u += -1.4 * 0.08 * Math.sin(lonRad * 3.0) * Math.sin(latRad * 2.0);
  v += -1.4 * 0.10 * Math.cos(lonRad * 3.0) * Math.cos(latRad * 2.0);

  // Synoptic Rossby Wave 2 (m=5, n=3)
  u += 0.7 * 0.12 * Math.cos(lonRad * 5.0) * Math.cos(latRad * 3.0);
  v += 0.7 * 0.14 * Math.sin(lonRad * 5.0) * Math.sin(latRad * 3.0);

  // 4. Arabian Sea & Indian Ocean Cross-Equatorial Monsoon Jet
  // Smooth 2D Gaussian envelope centered at (Lon 70°E, Lat 9°N) with wide sigmas (zero step cutoffs)
  const dLonMon = deltaLon(lon, 70.0);
  const dLatMon = lat - 9.0;
  const envMon = Math.exp(-(dLonMon * dLonMon) / (2 * 18 * 18) - (dLatMon * dLatMon) / (2 * 11 * 11));
  u += envMon * 5.2;
  v += envMon * (2.1 - 0.05 * dLonMon);

  // 5. Bay of Bengal Cyclonic Depression (Centering at Lon 88.33°E, Lat 17.05°N)
  // Gaussian-Rankine vortex with solid-body core and asymptotic smooth decay (zero artificial if-gate)
  const dxBoB = deltaLon(lon, 88.33);
  const dyBoB = lat - 17.05;
  const rSqBoB = dxBoB * dxBoB + dyBoB * dyBoB;
  const envBoB = Math.exp(-rSqBoB / (2 * 6.8 * 6.8));
  const rBoB = Math.sqrt(rSqBoB);
  const rCoreBoB = 2.4;
  const vTanBoB = (13.5 * (rBoB / rCoreBoB)) / (1.0 + (rBoB / rCoreBoB) ** 2) * envBoB;
  const invRBoB = 1.0 / (rBoB + 0.15);
  u += (-dyBoB * invRBoB) * vTanBoB + (-dxBoB * invRBoB) * (vTanBoB * 0.18);
  v += (dxBoB * invRBoB) * vTanBoB + (-dyBoB * invRBoB) * (vTanBoB * 0.18);

  // 6. Sri Lanka & Gulf of Mannar Coastal Deflection (Lon 80.6°E, Lat 7.8°N)
  const dxSL = deltaLon(lon, 80.6);
  const dySL = lat - 7.8;
  const rSqSL = dxSL * dxSL + dySL * dySL;
  const envSL = Math.exp(-rSqSL / (2 * 3.5 * 3.5));
  const invRSL = 1.0 / (Math.sqrt(rSqSL) + 0.2);
  u += (-dySL * invRSL) * (envSL * 3.8);
  v += (dxSL * invRSL) * (envSL * 3.8) - envSL * 0.8;

  // 6b. Palk Strait & Jaffna Coastal Eddy (Lon 80.2°E, Lat 9.8°N)
  const dxJ = deltaLon(lon, 80.2);
  const dyJ = lat - 9.8;
  const rSqJ = dxJ * dxJ + dyJ * dyJ;
  const envJ = Math.exp(-rSqJ / (2 * 2.2 * 2.2));
  const invRJ = 1.0 / (Math.sqrt(rSqJ) + 0.2);
  u += (-dyJ * invRJ) * (envJ * 2.6);
  v += (dxJ * invRJ) * (envJ * 2.6);

  // 7. Dynamic Tropical Cyclones (Rankine-Holland vortex with hemisphere Coriolis spin & inward spiral)
  // Naturally animates streamlines rotating around every active cyclone across the globe
  const activeCyclones = getActiveCyclones();
  for (let i = 0; i < activeCyclones.length; i++) {
    const cVec = computeCycloneVelocity(lon, lat, activeCyclones[i]);
    u += cVec.u;
    v += cVec.v;
  }

  const mag = Math.sqrt(u * u + v * v);
  return { u, v, mag };
}

function getLocalTemperature(lon, lat) {
  const cached = getCachedPointTemperature(lat, lon);
  return cached != null ? Math.round(cached) : null;
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
  const dynamicCyclones = getActiveCyclones();
  for (let i = 0; i < dynamicCyclones.length; i++) {
    const cRain = computeCyclonePrecipitation(lon, lat, dynamicCyclones[i]);
    rain = Math.max(rain, cRain);
  }
  return Math.round(rain * 10) / 10;
}

function getLocalPressure(lon, lat) {
  let p = 1013;
  const dynamicCyclones = getActiveCyclones();
  for (let i = 0; i < dynamicCyclones.length; i++) {
    p -= computeCyclonePressureDrop(lon, lat, dynamicCyclones[i]);
  }
  if (lat >= 29.0 && lat <= 36.0 && lon >= 74.0 && lon <= 88.0) {
    p -= 12;
  }
  return Math.round(p);
}

function getLocalConvectiveRisk(lon, lat, stations = STATIONS_NETWORK, threatData = null, cloudburstEvent = null) {
  // Check live client-side ML prediction cache first
  const mlData = getCachedMLRisk(lat, lon);
  if (mlData?.riskPercent != null) {
    return mlData.riskPercent;
  }

  // 1. If active cloudburst hazard epicenter passes >= 25%, calculate convective plume influence from that epicenter
  if (cloudburstEvent?.coordinates && (cloudburstEvent?.isAlertActive || (cloudburstEvent.metrics?.riskPercent ?? 0) >= 25)) {
    const [eLon, eLat] = cloudburstEvent.coordinates;
    const dLat = lat - eLat;
    const dLon = (lon - eLon) * Math.cos((lat * Math.PI) / 180);
    const distSq = dLat * dLat + dLon * dLon;
    const radiusKm = cloudburstEvent.hazardRadiusKm || 30;
    const radiusDeg = radiusKm / 111.0;
    const maxDistSq = radiusDeg * radiusDeg * 3.5;

    if (distSq < maxDistSq) {
      const factor = Math.exp(-distSq / (radiusDeg * radiusDeg * 0.9));
      const peakRisk = cloudburstEvent.metrics?.riskPercent ?? 75;
      return Math.min(99, Math.max(4, Math.round(peakRisk * factor)));
    }
  }

  // 2. Normal ambient ML baseline (~3% - 4% for plains and mountains in current weather)
  const isMountain = lat >= 29.5 && lat <= 35.5 && lon >= 74.0 && lon <= 81.0;
  return isMountain ? 4 : 3;
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
  if (!map || !map.getStyle()) return;

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
  if (!map || !map.getStyle()) return;

  // 1. High-Resolution Global Satellite Raster Source with Google/Esri tiles
  if (!map.getSource('esri-satellite')) {
    map.addSource('esri-satellite', {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
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

  // 3. Continuous Weather Raster Layers (Temperature, Wind Speed, Doppler Radar)
  const weatherRasterKeys = ['temp', 'wind', 'precip'];
  weatherRasterKeys.forEach((key) => {
    const cfg = WEATHER_LAYERS[key];
    if (!cfg) return;

    // Clean up legacy procedural source if transitioning to Open-Meteo
    if (key === 'temp' && map.getSource('weatherapi-temp-source') && cfg.sourceId !== 'weatherapi-temp-source') {
      if (map.getLayer('weatherapi-temp-layer')) map.removeLayer('weatherapi-temp-layer');
      map.removeSource('weatherapi-temp-source');
    }

    if (!map.getSource(cfg.sourceId)) {
      if (cfg.url) {
        map.addSource(cfg.sourceId, {
          type: 'raster',
          url: cfg.url,
          attribution: '&copy; Open-Meteo & ECMWF'
        });
      } else {
        map.addSource(cfg.sourceId, {
          type: 'raster',
          tiles: [getWeatherApiTileUrl(cfg.layerKey)],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 14, // Seamless procedural thermodynamic generators support crisp tiles across all zoom levels
          attribution: '&copy; BurstWatch'
        });
      }
    }

    // Live Temperature Layer: Real ECMWF IFS atmospheric model (Open-Meteo)
    // Pre-warmed with layout visibility 'visible' and opacity 0.0 for 0ms instant display upon activation
    const isThisRasterVisible = activeLayer === 'temp' && key === 'temp';
    const rasterLayoutVisibility = key === 'temp' ? 'visible' : (isThisRasterVisible ? 'visible' : 'none');

    if (!map.getLayer(cfg.layerId)) {
      map.addLayer({
        id: cfg.layerId,
        type: 'raster',
        source: cfg.sourceId,
        layout: {
          visibility: rasterLayoutVisibility
        },
        paint: {
          'raster-opacity': isThisRasterVisible ? (cfg.opacity ?? 0.72) : 0.0,
          'raster-fade-duration': 250,
          'raster-resampling': 'linear'
        }
      }, beforeId);
    } else {
      map.setLayoutProperty(cfg.layerId, 'visibility', rasterLayoutVisibility);
      try {
        map.setPaintProperty(cfg.layerId, 'raster-opacity', isThisRasterVisible ? (cfg.opacity ?? 0.72) : 0.0);
        map.setPaintProperty(cfg.layerId, 'raster-fade-duration', 250);
        map.setPaintProperty(cfg.layerId, 'raster-resampling', 'linear');
      } catch (e) {}
    }
  });

  // Clean up any isotherm contour layers to ensure 100% number-free, clean Windy aesthetic
  ['isotherm-contours-glow', 'isotherm-contours-line'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource('isotherm-contours-source')) {
    map.removeSource('isotherm-contours-source');
  }

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

  // Convective Plume is only visible when convective layer is selected
  const isConvectiveVis = activeLayer === 'convective';

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
          0, 0.50,
          3, 0.75,
          6, 1.10,
          9, 1.60,
          12, 2.20
        ],
        // Authentic atmospheric convective cloudburst color spectrum:
        // Deep, rich progression from indigo -> cyan -> green -> yellow -> orange -> crimson -> deep maroon core
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0.00, 'rgba(0, 0, 0, 0)',
          0.10, 'rgba(49, 46, 129, 0.28)',   // Translucent deep convective indigo
          0.25, 'rgba(14, 165, 233, 0.58)',  // Active cyan flux
          0.42, 'rgba(34, 197, 94, 0.72)',   // Green unstable atmospheric boundary
          0.60, 'rgba(234, 179, 8, 0.84)',   // Warm amber squall front
          0.76, 'rgba(249, 115, 22, 0.92)',  // Vibrant orange convective updraft
          0.88, 'rgba(220, 38, 38, 0.96)',   // Crimson severe cloudburst zone
          1.00, 'rgba(136, 19, 55, 0.98)'   // Deep maroon-magenta cloudburst core (no hollow whiteout)
        ],
        // Smooth radius so adjacent valley nodes coalesce into a fluid, natural plume
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 18,
          2, 28,
          4, 42,
          6, 62,
          8, 90,
          10, 125,
          12, 160
        ],
        'heatmap-opacity': isConvectiveVis ? 0.78 : 0.0
      }
    }, beforeId);
  } else {
    map.setLayoutProperty(HEATMAP_LAYER_ID, 'visibility', isConvectiveVis ? 'visible' : 'none');
    map.setPaintProperty(HEATMAP_LAYER_ID, 'heatmap-opacity', isConvectiveVis ? 0.78 : 0.0);
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
    map.setPaintProperty(HEATMAP_POINT_LAYER_ID, 'circle-opacity', isConvectiveVis ? 0.85 : 0.0);
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

    const isHazardVis = activeLayer === 'convective';

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
  const isRadar = activeLayer === 'precip';

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

  // C. Live RainViewer Doppler Radar Tiles (TITAN Multi-Stop High-Definition Smooth Raster)
  if (radarTimestampPath) {
    // RainViewer Scheme 3 (TITAN / Ventusky standard) with smooth interpolation and snow detection
    const dopplerTileUrl = `https://tilecache.rainviewer.com${radarTimestampPath}/512/{z}/{x}/{y}/3/1_1.png`;

    if (!map.getSource('doppler-radar-source')) {
      map.addSource('doppler-radar-source', {
        type: 'raster',
        tiles: [dopplerTileUrl],
        tileSize: 512,
        minzoom: 0,
        maxzoom: 7, // RainViewer supports up to zoom 7; MapLibre overzooms smoothly with GPU bilinear filtering
        attribution: '&copy; RainViewer.com'
      });
    } else {
      try {
        const source = map.getSource('doppler-radar-source');
        if (source && typeof source.setTiles === 'function') {
          source.setTiles([dopplerTileUrl]);
        }
      } catch (e) {}
    }

    if (!map.getLayer('doppler-radar-layer')) {
      map.addLayer({
        id: 'doppler-radar-layer',
        type: 'raster',
        source: 'doppler-radar-source',
        layout: { visibility: isRadar ? 'visible' : 'none' },
        paint: {
          'raster-opacity': isRadar ? 0.88 : 0.0,
          'raster-resampling': 'linear',
          'raster-fade-duration': 250
        }
      }, beforeId);
    } else {
      map.setLayoutProperty('doppler-radar-layer', 'visibility', isRadar ? 'visible' : 'none');
      try {
        map.setPaintProperty('doppler-radar-layer', 'raster-opacity', isRadar ? 0.88 : 0.0);
        map.setPaintProperty('doppler-radar-layer', 'raster-fade-duration', 250);
      } catch (e) {}
    }
  } else if (map.getLayer('doppler-radar-layer')) {
    map.setLayoutProperty('doppler-radar-layer', 'visibility', 'none');
  }

  // E. Live Real-Time Lightning Strikes Feed (Direct Blitzortung + Convective Storms)
  const isLightningVis = isRadar || activeLayer === 'precip' || activeLayer === 'radar' || activeLayer === 'thunderstorms';
  const lightningData = getLightningStrikesGeoJSON();

  if (!map.getSource('lightning-strikes-source')) {
    map.addSource('lightning-strikes-source', {
      type: 'geojson',
      data: lightningData
    });
  } else {
    map.getSource('lightning-strikes-source').setData(lightningData);
  }
  if (!map.getLayer('lightning-strikes-glow')) {
    map.addLayer({
      id: 'lightning-strikes-glow',
      type: 'circle',
      source: 'lightning-strikes-source',
      layout: { visibility: isLightningVis ? 'visible' : 'none' },
      paint: {
        'circle-radius': 16,
        'circle-color': '#facc15',
        'circle-opacity': 0.45,
        'circle-blur': 0.85
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('lightning-strikes-glow', 'visibility', isLightningVis ? 'visible' : 'none');
  }
  if (!map.getLayer('lightning-strikes-core')) {
    map.addLayer({
      id: 'lightning-strikes-core',
      type: 'circle',
      source: 'lightning-strikes-source',
      layout: { visibility: isLightningVis ? 'visible' : 'none' },
      paint: {
        'circle-radius': 4.0,
        'circle-color': '#ffffff',
        'circle-stroke-color': '#eab308',
        'circle-stroke-width': 2.0
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('lightning-strikes-core', 'visibility', isLightningVis ? 'visible' : 'none');
  }

  // Clean up legacy antimeridian seam layers if previously attached
  if (map.getLayer('antimeridian-seam-layer')) {
    map.removeLayer('antimeridian-seam-layer');
  }
  if (map.getSource('antimeridian-seam-source')) {
    map.removeSource('antimeridian-seam-source');
  }

  // 6.5 Progressive Multi-Tier Windy Vector Hierarchy
  const isOverlayVisible = isSatellite || activeLayer === 'temp' || activeLayer === 'precip' || isHeatmapVisible;

  // A. Razor-Sharp Vector National Borders & Coastlines (Visible across all zooms)
  if (!map.getSource('world-countries-source')) {
    map.addSource('world-countries-source', {
      type: 'geojson',
      data: WORLD_COUNTRIES_DATA
    });
  }

  if (!map.getLayer('windy-country-borders')) {
    map.addLayer({
      id: 'windy-country-borders',
      type: 'line',
      source: 'world-countries-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: isOverlayVisible ? 'visible' : 'none'
      },
      paint: {
        'line-color': '#111827',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          1, 0.70,
          2, 0.85,
          5, 1.25,
          8, 1.85
        ],
        'line-opacity': 0.78
      }
    });
  } else {
    map.setLayoutProperty('windy-country-borders', 'visibility', isOverlayVisible ? 'visible' : 'none');
  }

  // B. Sleek Continental & Country Overview Labels (Only at global zoom 1.0 - 5.0)
  // Replicates authentic Windy synoptic typography without any city clutter at high zoom
  if (!map.getSource('world-overview-labels-source')) {
    map.addSource('world-overview-labels-source', {
      type: 'geojson',
      data: WORLD_OVERVIEW_LABELS
    });
  }

  if (!map.getLayer('windy-overview-labels')) {
    map.addLayer({
      id: 'windy-overview-labels',
      type: 'symbol',
      source: 'world-overview-labels-source',
      maxzoom: 5.0, // Automatically fades out as you zoom in, letting detailed city labels take over
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          1, 9,
          2, 10,
          3.5, 12,
          5, 13.5
        ],
        'text-letter-spacing': 0.16,
        'text-transform': 'uppercase',
        'text-allow-overlap': true,
        visibility: isOverlayVisible ? 'visible' : 'none'
      },
      paint: {
        'text-color': '#f8fafc',
        'text-halo-color': 'rgba(15, 23, 42, 0.90)',
        'text-halo-width': 1.6,
        'text-halo-blur': 1.0,
        'text-opacity': 0.88
      }
    });
  } else {
    map.setLayoutProperty('windy-overview-labels', 'visibility', isOverlayVisible ? 'visible' : 'none');
  }

  // C. Progressive Multi-Tier Vector Places (Dynamic Zoom LoD)
  // Tier 1: Major Metros (Zoom >= 4.2)
  // Tier 2: State Names (Zoom 4.8 - 7.2)
  // Tier 3: Regional Cities (Zoom >= 5.8)
  // Tier 4: Mountain Valleys & Local Stations (Zoom >= 7.8)
  if (!map.getSource('hierarchical-places-source')) {
    map.addSource('hierarchical-places-source', {
      type: 'geojson',
      data: HIERARCHICAL_PLACES
    });
  }

  // 1. Major Metros & Capitals
  if (!map.getLayer('windy-places-metros')) {
    map.addLayer({
      id: 'windy-places-metros',
      type: 'symbol',
      source: 'hierarchical-places-source',
      minzoom: 4.2,
      filter: ['all', ['<=', ['get', 'minZoom'], 4.5], ['!=', ['get', 'isState'], true]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          4.2, 11,
          7, 13,
          11, 15
        ],
        'text-anchor': 'top',
        'text-offset': [0, 0.4],
        'text-allow-overlap': false,
        visibility: isOverlayVisible ? 'visible' : 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(15, 23, 42, 0.95)',
        'text-halo-width': 1.8,
        'text-halo-blur': 0.8,
        'text-opacity': 0.96
      }
    });
  } else {
    map.setLayoutProperty('windy-places-metros', 'visibility', isOverlayVisible ? 'visible' : 'none');
  }

  // 2. State Names
  if (!map.getLayer('windy-places-states')) {
    map.addLayer({
      id: 'windy-places-states',
      type: 'symbol',
      source: 'hierarchical-places-source',
      minzoom: 4.8,
      maxzoom: 7.2,
      filter: ['==', ['get', 'isState'], true],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10.5,
        'text-letter-spacing': 0.14,
        'text-transform': 'uppercase',
        'text-allow-overlap': false,
        visibility: isOverlayVisible ? 'visible' : 'none'
      },
      paint: {
        'text-color': 'rgba(241, 245, 249, 0.85)',
        'text-halo-color': 'rgba(15, 23, 42, 0.90)',
        'text-halo-width': 1.5,
        'text-halo-blur': 1.0,
        'text-opacity': 0.82
      }
    });
  } else {
    map.setLayoutProperty('windy-places-states', 'visibility', isOverlayVisible ? 'visible' : 'none');
  }

  // 3. Regional Cities & Meteorological Centers
  if (!map.getLayer('windy-places-regional')) {
    map.addLayer({
      id: 'windy-places-regional',
      type: 'symbol',
      source: 'hierarchical-places-source',
      minzoom: 5.8,
      filter: ['all', ['>=', ['get', 'minZoom'], 5.5], ['<', ['get', 'minZoom'], 7.5], ['!=', ['get', 'isState'], true]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          5.8, 10.5,
          8, 12,
          11, 14
        ],
        'text-anchor': 'top',
        'text-offset': [0, 0.3],
        'text-allow-overlap': false,
        visibility: isOverlayVisible ? 'visible' : 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(15, 23, 42, 0.92)',
        'text-halo-width': 1.6,
        'text-halo-blur': 0.8,
        'text-opacity': 0.95
      }
    });
  } else {
    map.setLayoutProperty('windy-places-regional', 'visibility', isOverlayVisible ? 'visible' : 'none');
  }

  // 4. Mountain Valleys, Towns & Local Stations
  if (!map.getLayer('windy-places-valleys')) {
    map.addLayer({
      id: 'windy-places-valleys',
      type: 'symbol',
      source: 'hierarchical-places-source',
      minzoom: 7.8,
      filter: ['>=', ['get', 'minZoom'], 7.8],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10.5,
        'text-anchor': 'top',
        'text-offset': [0, 0.3],
        'text-allow-overlap': false,
        visibility: isOverlayVisible ? 'visible' : 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(15, 23, 42, 0.92)',
        'text-halo-width': 1.5,
        'text-halo-blur': 0.8,
        'text-opacity': 0.95
      }
    });
  } else {
    map.setLayoutProperty('windy-places-valleys', 'visibility', isOverlayVisible ? 'visible' : 'none');
  }

  // D. Global Road Networks & Small Area Raster Overlay (Fades in dynamically at zoom >= 6.0)
  if (!map.getSource('esri-reference-labels')) {
    map.addSource('esri-reference-labels', {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; Esri & OpenStreetMap'
    });
  }

  if (!map.getLayer('overlay-labels-and-boundaries')) {
    map.addLayer({
      id: 'overlay-labels-and-boundaries',
      type: 'raster',
      source: 'esri-reference-labels',
      minzoom: 6.0, // Only visible as you zoom closer! Eliminates all global clutter
      layout: {
        visibility: isOverlayVisible ? 'visible' : 'none'
      },
      paint: {
        'raster-opacity': isOverlayVisible ? 1.0 : 0.0,
        'raster-fade-duration': 250
      }
    });
  } else {
    map.setLayoutProperty('overlay-labels-and-boundaries', 'visibility', isOverlayVisible ? 'visible' : 'none');
    try {
      map.setPaintProperty('overlay-labels-and-boundaries', 'raster-opacity', isOverlayVisible ? 1.0 : 0.0);
    } catch (e) {}
  }

  // 7. Refresh place label typography
  applyMapLabelsTheme(map, isSatellite);
}

// Clean, high-performance MapLibre GL JS map component with a built-in heatmap
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
  mapView = 'liberty',
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

  // Active weather overlay layer ('temp' | 'precip' | 'convective' | 'none')
  const [selectedWeatherLayer, setSelectedWeatherLayer] = useState(activeLayer || 'temp');
  const [tileError, setTileError] = useState(null);
  const [isTempLoading, setIsTempLoading] = useState(false);
  const weatherTileTimestampRef = useRef(getWeatherApiTimestamp());

  useEffect(() => {
    if (activeLayer) {
      setSelectedWeatherLayer(activeLayer);
    }
  }, [activeLayer]);

  const handleSelectWeatherLayer = useCallback((layerKey) => {
    setSelectedWeatherLayer(layerKey);
    if (onChangeActiveLayer) {
      onChangeActiveLayer(layerKey);
    }
    if (layerKey === 'wind') {
      onToggleParticles?.(true);
      onWindParticleModeChange?.('strong');
    } else if (layerKey === 'temp') {
      preloadTemperatureEngine();
      if (mapRef.current) {
        const isLoaded = mapRef.current.isSourceLoaded('openmeteo-temp-source');
        if (!isLoaded) {
          setIsTempLoading(true);
        }
      }
    }
  }, [onChangeActiveLayer, onToggleParticles, onWindParticleModeChange]);

  // Synchronized ref for 2D vs 3D projection to prevent stale closures in event handlers
  const is3DRef = useRef(is3D);
  is3DRef.current = is3D;

  const mapViewRef = useRef(mapView);
  mapViewRef.current = mapView;
  const selectedWeatherLayerRef = useRef(selectedWeatherLayer);
  selectedWeatherLayerRef.current = selectedWeatherLayer;
  const showTempRef = useRef(showTemperature);
  showTempRef.current = showTemperature;
  const tempUnitRef = useRef(tempUnit);
  tempUnitRef.current = tempUnit;

  useEffect(() => {
    selectedWeatherLayerRef.current = selectedWeatherLayer;
  }, [selectedWeatherLayer]);

  useEffect(() => {
    showTempRef.current = showTemperature;
  }, [showTemperature]);

  useEffect(() => {
    tempUnitRef.current = tempUnit;
  }, [tempUnit]);

  // Dynamic map scale bar state (Metric vs Imperial)
  const [scaleUnit, setScaleUnit] = useState('metric');
  const [scaleInfo, setScaleInfo] = useState({ widthPx: 64, label: '200 km' });
  const scaleUnitRef = useRef(scaleUnit);
  scaleUnitRef.current = scaleUnit;

  // Real-time hover cursor coordinates (shows ONLY coordinates on hover)
  const [hoverCoords, setHoverCoords] = useState(null);

  // Clicked pin marker with live temperature
  const [clickedPin, setClickedPin] = useState(null);
  const [clickedPinScreenPos, setClickedPinScreenPos] = useState(null);
  const clickedPinRef = useRef(null);
  const clickedPinScreenPosRef = useRef(null);
  clickedPinRef.current = clickedPin;
  clickedPinScreenPosRef.current = clickedPinScreenPos;
  const mouseMoveRafRef = useRef(null);

  // Drops or moves the pin to coordinates and retrieves live temperature
  const setPinAtCoords = useCallback((lng, lat, customName = null) => {
    const map = mapRef.current;
    const name = customName || getSectorName(lng, lat);
    const initialTemp = getCachedPointTemperature(lat, lng);

    setClickedPin({
      lat,
      lon: lng,
      temp: initialTemp,
      loading: initialTemp == null,
      name
    });

    if (map) {
      try {
        const pt = map.project([lng, lat]);
        setClickedPinScreenPos({ x: pt.x, y: pt.y });
        clickedPinScreenPosRef.current = { x: pt.x, y: pt.y };
      } catch (e) {}
    }

    const zoom = map ? Math.round(map.getZoom()) : 4;
    getLiveTemperature(lat, lng, zoom).then((realTemp) => {
      if (realTemp != null) {
        setClickedPin((prev) => (prev && prev.lat === lat && prev.lon === lng ? { ...prev, temp: realTemp, loading: false } : prev));
      }
    });
  }, []);

  // Muted Thunder Synthesizer state
  const [isThunderMuted, setIsThunderMuted] = useState(() => thunderSynth.isMuted());

  // RainViewer live Doppler radar state
  const [radarFrames, setRadarFrames] = useState([]);
  const [radarStatus, setRadarStatus] = useState('loading');

  // Fetch the latest RainViewer radar frames and refresh every 10 minutes
  useEffect(() => {
    let isMounted = true;
    const fetchRadarTimestamp = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`RainViewer returned HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!isMounted) return;

        const past = data?.radar?.past;
        if (Array.isArray(past) && past.length > 0) {
          setRadarFrames(past);
          setRadarStatus('ready');
        } else {
          setRadarFrames([]);
          setRadarStatus('unavailable');
        }
      } catch (error) {
        if (!isMounted) return;
        console.warn('[RainViewer] Unable to load radar frames:', error);
        setRadarFrames([]);
        setRadarStatus('unavailable');
      } finally {
        clearTimeout(timeoutId);
      }
    };

    fetchRadarTimestamp();
    const pollInterval = setInterval(fetchRadarTimestamp, 10 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  const currentRadarFrame = radarFrames.length > 0 ? radarFrames[radarFrames.length - 1] : null;
  const radarTimestampPath = currentRadarFrame?.path || null;
  const radarTimestampTime = currentRadarFrame?.time
    ? new Date(currentRadarFrame.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  // Ambient procedural rain sound drone
  useEffect(() => {
    if (selectedWeatherLayer === 'precip' && !isThunderMuted) {
      thunderSynth.startRainDrone(0.5);
    } else {
      thunderSynth.stopRainDrone();
    }
    return () => {
      thunderSynth.stopRainDrone();
    };
  }, [selectedWeatherLayer, isThunderMuted]);

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

  // Dedicated falling rain veil particle buffer for Rain Radar
  const MAX_RAIN_PARTICLES = 700;
  const rainParticlesRef = useRef({
    x: new Float32Array(MAX_RAIN_PARTICLES),
    y: new Float32Array(MAX_RAIN_PARTICLES),
    speed: new Float32Array(MAX_RAIN_PARTICLES)
  });

  // Dynamically compute the GeoJSON FeatureCollection for MapLibre's built-in heatmap renderer
  const heatmapGeoJSON = useMemo(() => {
    return generateCloudburstHeatmapGeoJSON({
      stations,
      selectedStation,
      cloudburstEvent,
      threatData,
      humidity,
      pressureDrop
    });
  }, [stations, selectedStation, cloudburstEvent, threatData, humidity, pressureDrop]);

  // Flat 2D Mercator Projection (Globe and 3D tilt completely removed)
  const apply3DState = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (map.getStyle()) {
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

  // Clean map marker renderer (pin and station black dots removed as requested)
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
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
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
  }, [userLocation]);

  // Initialize MapLibre GL JS with a raster basemap
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const containerWidth = mapContainerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1440);
    // Dynamic minimum zoom: At zoom z, Mercator width is 512 * 2^z.
    // Screen-width coverage: 512 * 2^z = width => z = log2(width / 512)
    // Allows zooming out until the world map covers the full width of the screen
    const initialMinZoom = Math.max(1.0, Math.log2(containerWidth / 512));

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLE,
      center: [78.96, 22.50],
      zoom: 4.2,
      minZoom: initialMinZoom,
      maxZoom: 17,
      maxPitch: 0,
      pitch: 0,
      antialias: true,
      renderWorldCopies: true,
      attributionControl: true,
      preserveDrawingBuffer: false,
      fadeDuration: 0
    });

    mapRef.current = map;
    window.map = map;

    const handleMapError = (event) => {
      if (event.sourceId === 'basemap') {
        setTileError({
          scope: 'base',
          message: 'Street map tiles could not be loaded. Check your connection and try again.'
        });
        return;
      }

      if (event.sourceId === 'esri-satellite' && mapViewRef.current === 'satellite') {
        setTileError({
          scope: 'map',
          mapView: 'satellite',
          message: 'Satellite imagery is temporarily unavailable. Switch back to the street map or try again later.'
        });
        return;
      }

      if (event.sourceId === 'doppler-radar-source' && selectedWeatherLayerRef.current === 'precip') {
        setTileError({
          scope: 'layer',
          layer: 'precip',
          message: 'Rain radar tiles are temporarily unavailable.'
        });
        return;
      }

      const failedWeatherLayer = Object.values(WEATHER_LAYERS).find(
        (layer) => layer.sourceId === event.sourceId
      );
      if (failedWeatherLayer && selectedWeatherLayerRef.current === failedWeatherLayer.id) {
        setTileError({
          scope: 'layer',
          layer: failedWeatherLayer.id,
          message: `${failedWeatherLayer.label} tiles are temporarily unavailable.`
        });
      }
    };

    map.on('error', handleMapError);

    const onStyleReady = () => {
      const isSat = mapViewRef.current === 'satellite';
      const isHeatmapVis = showTemperature;

      applyMapLayersAndHeatmap(map, isSat, selectedWeatherLayer, isHeatmapVis, heatmapGeoJSON, radarTimestampPath, cloudburstEvent);
      apply3DState(is3DRef.current, false);
      renderStationMarkers(map);
    };

    map.on('load', () => {
      onStyleReady();



      // Dynamic reactive map scale and minZoom listener
      const handleScaleUpdate = () => {
        const nextScale = calculateMapScale(map, 76, scaleUnitRef.current);
        setScaleInfo(nextScale);
      };

      const handleResize = () => {
        handleScaleUpdate();
        if (mapContainerRef.current) {
          const w = mapContainerRef.current.clientWidth || window.innerWidth;
          const targetMinZoom = Math.max(1.0, Math.log2(w / 512));
          map.setMinZoom(targetMinZoom);
        }
      };

      map.on('zoom', handleScaleUpdate);
      map.on('move', handleScaleUpdate);
      map.on('resize', handleResize);
      handleScaleUpdate();

      // Open-Meteo temperature tile loading status monitor
      const handleSourceData = (e) => {
        if (e.sourceId === 'openmeteo-temp-source' && e.isSourceLoaded) {
          setIsTempLoading(false);
        }
      };
      map.on('sourcedata', handleSourceData);

      map.once('idle', () => {
        if (map.isSourceLoaded('openmeteo-temp-source')) {
          setIsTempLoading(false);
        }
      });
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

  // Live Real-Time Lightning Strikes Stream & Flash Glow Animation
  useEffect(() => {
    // 1. Subscribe to strike GeoJSON stream
    const unsubscribeStrikes = subscribeLightningStrikes((strikes, geojson) => {
      const activeMap = mapRef.current;
      if (activeMap && activeMap.getStyle() && activeMap.getSource('lightning-strikes-source')) {
        activeMap.getSource('lightning-strikes-source').setData(geojson);
      }
    });

    // 2. Subscribe to individual strike arrival for CSS flash glow animation
    const unsubscribeFlashes = subscribeLightningFlashes((strike) => {
      const activeMap = mapRef.current;
      if (!activeMap) return;

      // Create glowing flash element with shockwave ripple
      const el = document.createElement('div');
      el.className = 'lightning-flash-marker pointer-events-none select-none -translate-x-1/2 -translate-y-1/2';
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-14 h-14 rounded-full border border-white/95 animate-lightning-shockwave"></span>
          <span class="absolute w-8 h-8 rounded-full bg-cyan-300/40 blur-xs animate-ping"></span>
          <div class="relative w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-[0_0_18px_#ffffff,0_0_30px_#38bdf8] animate-lightning-flash">
            <svg class="w-3.5 h-3.5 text-cyan-500 fill-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([strike.lon, strike.lat])
        .addTo(activeMap);

      // Clean up after flash animation finishes
      setTimeout(() => {
        try {
          marker.remove();
        } catch (e) {}
      }, 1900);
    });

    return () => {
      unsubscribeStrikes();
      unsubscribeFlashes();
    };
  }, []);

  // Reactively update Built-in Heatmap, WeatherAPI, Cloudburst Hazard & Doppler Radar Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getStyle()) return;

    const isSat = mapView === 'satellite';
    const isHeatmapVis = showTemperature;

    applyMapLayersAndHeatmap(map, isSat, selectedWeatherLayer, isHeatmapVis, heatmapGeoJSON, radarTimestampPath, cloudburstEvent);
  }, [heatmapGeoJSON, showTemperature, mapView, selectedWeatherLayer, radarTimestampPath, cloudburstEvent]);

  useEffect(() => {
    const refreshForecastTiles = () => {
      const validTime = new Date();
      validTime.setUTCMinutes(0, 0, 0);
      const timestamp = getWeatherApiTimestamp(validTime);
      if (timestamp === weatherTileTimestampRef.current) return;

      weatherTileTimestampRef.current = timestamp;

      const map = mapRef.current;
      if (!map?.getStyle()) return;

      ['temp', 'wind', 'precip'].forEach((key) => {
        const layer = WEATHER_LAYERS[key];
        const source = map.getSource(layer.sourceId);
        if (source && 'setTiles' in source && typeof source.setTiles === 'function') {
          source.setTiles([getWeatherApiTileUrl(layer.layerKey, validTime)]);
        }
      });
    };

    const intervalId = window.setInterval(refreshForecastTiles, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

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

    const isVisualWeatherLayer = selectedWeatherLayer === 'wind' || selectedWeatherLayer === 'temp' || selectedWeatherLayer === 'precip';
    const isOff = (!showParticles || windParticleMode === 'off') && !isVisualWeatherLayer;
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

    let centerLng = 78.96, centerLat = 22.50, scale = 1, cX = 0, cY = 0;
    let isPitchedOrRotated = false;

    const updateCameraCache = () => {
      try {
        const center = map.getCenter();
        centerLng = center.lng;
        centerLat = center.lat;
        const z = map.getZoom();
        const pitch = map.getPitch();
        const bearing = map.getBearing();
        isPitchedOrRotated = (pitch !== 0 || bearing !== 0);

        scale = 512 * Math.pow(2, z);
        cX = scale * (centerLng / 360 + 0.5);
        const latRad = (centerLat * Math.PI) / 180;
        cY = scale * (0.5 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / (2 * Math.PI));
      } catch (e) {}
    };

    // Closed-form Web Mercator unprojection (Zero-overhead, immune to antimeridian seam bugs)
    const screenToLngLat = (px, py) => {
      if (isPitchedOrRotated) {
        const pt = map.unproject([px, py]);
        return { lng: pt.lng, lat: pt.lat };
      }
      const wx = cX + (px - canvas.width * 0.5);
      const wy = cY + (py - canvas.height * 0.5);
      const lng = ((wx / scale) - 0.5) * 360;
      const lat = (2 * Math.atan(Math.exp((0.5 - wy / scale) * 2 * Math.PI)) - Math.PI / 2) * (180 / Math.PI);
      return { lng, lat };
    };

    const clearCanvasTrails = () => {
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

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
          p.age[i] = Math.floor(Math.random() * 80);
          p.maxAge[i] = 70 + Math.floor(Math.random() * 80);
          p.speed[i] = 0.85 + Math.random() * 0.30;
        }

        const rainP = rainParticlesRef.current;
        for (let i = 0; i < MAX_RAIN_PARTICLES; i++) {
          rainP.x[i] = Math.random() * canvas.width;
          rainP.y[i] = Math.random() * canvas.height;
          rainP.speed[i] = 0.85 + Math.random() * 0.35;
        }
      }
    };

    resize();
    updateCameraCache();

    map.on('resize', resize);
    map.on('movestart', clearCanvasTrails);
    map.on('zoomstart', clearCanvasTrails);

    const onMapMove = () => {
      updateCameraCache();
      clearCanvasTrails();
    };

    map.on('move', onMapMove);
    map.on('zoom', onMapMove);
    map.on('moveend', onMapMove);
    map.on('zoomend', onMapMove);

    let isRunning = true;

    const render = () => {
      const mode = windModeRef.current || 'normal';
      const isVisualWeatherLayer = selectedWeatherLayer === 'wind' || selectedWeatherLayer === 'temp' || selectedWeatherLayer === 'precip';
      if (!isRunning || ((!showParticles || mode === 'off') && !isVisualWeatherLayer)) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Dedicated Rain Veil & IMD Doppler Radar Station Sweep Animation Loop
      if (selectedWeatherLayer === 'precip') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';

        const rainP = rainParticlesRef.current;
        const width = canvas.width;
        const height = canvas.height;

        // 1. Render Slanted Rain Veil Filaments (translucent crystal rain filaments drifting along RK2 wind vectors)
        ctx.beginPath();
        ctx.lineWidth = 0.85;
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.32)';
        ctx.lineCap = 'round';

        for (let i = 0; i < MAX_RAIN_PARTICLES; i++) {
          const rx = rainP.x[i];
          const ry = rainP.y[i];

          // Sample local wind drift
          const pos = screenToLngLat(rx, ry);
          const cosLat = Math.max(0.18, Math.cos((pos.lat * Math.PI) / 180));
          const wind = getWindVector(pos.lng, pos.lat);
          const uNorm = wind.u / cosLat;

          // Slanted velocity: downwards + horizontal wind drift
          const vy = 8.5 + rainP.speed[i] * 3.5;
          const vx = uNorm * 0.32;

          const streakLen = 14.0 + rainP.speed[i] * 8.0;
          const norm = Math.hypot(vx, vy);
          const dirX = vx / norm;
          const dirY = vy / norm;

          const tailX = rx - dirX * streakLen;
          const tailY = ry - dirY * streakLen;

          ctx.moveTo(tailX, tailY);
          ctx.lineTo(rx, ry);

          // Advance particle
          rainP.x[i] += vx;
          rainP.y[i] += vy;

          // Wrap around top or screen edges
          if (rainP.y[i] > height + 30 || rainP.x[i] < -30 || rainP.x[i] > width + 30) {
            rainP.x[i] = Math.random() * width;
            rainP.y[i] = -15 - Math.random() * 40;
            rainP.speed[i] = 0.85 + Math.random() * 0.35;
          }
        }
        ctx.stroke();

        // 2. Render Innovative Micro-Doppler Radar Station Beacons
        const now = Date.now();
        const sweepAngle = (now / 2200) * (Math.PI * 2);
        const pulsePhase = (now % 1800) / 1800;
        const pulseRadius = 3 + pulsePhase * 18;
        const pulseAlpha = Math.max(0, 1 - pulsePhase) * 0.45;

        // Dynamic scale based on zoom level: compact 14px to 18px radius
        const currentZoom = (typeof map.getZoom === 'function') ? map.getZoom() : 5;
        const sweepRadius = Math.max(13, Math.min(19, 13 + (currentZoom - 3) * 1.5));

        RADAR_COVERAGE_CENTERS.forEach((station) => {
          let sx, sy;
          if (isPitchedOrRotated) {
            const pt = map.project([station.lon, station.lat]);
            sx = pt.x;
            sy = pt.y;
          } else {
            const wx = scale * (station.lon / 360 + 0.5);
            const latRad = (station.lat * Math.PI) / 180;
            const wy = scale * (0.5 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / (2 * Math.PI));
            sx = wx - cX + width * 0.5;
            sy = wy - cY + height * 0.5;
          }

          if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) return;

          // A. Expanding Sonar Wave Ripple
          ctx.beginPath();
          ctx.arc(sx, sy, Math.min(sweepRadius * 1.35, pulseRadius), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${pulseAlpha})`;
          ctx.lineWidth = 0.85;
          ctx.stroke();

          // B. Micro Outer Perimeter Ring
          ctx.beginPath();
          ctx.arc(sx, sy, sweepRadius, 0, Math.PI * 2);
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.stroke();

          // C. Subtle 4-axis Micro Ticks at the ring boundary
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.60)';
          ctx.lineWidth = 0.8;
          ctx.moveTo(sx - sweepRadius - 2, sy); ctx.lineTo(sx - sweepRadius + 2, sy);
          ctx.moveTo(sx + sweepRadius - 2, sy); ctx.lineTo(sx + sweepRadius + 2, sy);
          ctx.moveTo(sx, sy - sweepRadius - 2); ctx.lineTo(sx, sy - sweepRadius + 2);
          ctx.moveTo(sx, sy + sweepRadius - 2); ctx.lineTo(sx, sy + sweepRadius + 2);
          ctx.stroke();

          // D. Rotating Phosphor Sweep Sector (45-degree micro-fan)
          const arcSpread = 0.75;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, sweepRadius, sweepAngle - arcSpread, sweepAngle, false);
          ctx.closePath();

          const grad = ctx.createRadialGradient(sx, sy, 1, sx, sy, sweepRadius);
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.50)');
          grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
          grad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
          ctx.fillStyle = grad;
          ctx.fill();

          // E. Crisp Leading Micro-Needle
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(
            sx + Math.cos(sweepAngle) * sweepRadius,
            sy + Math.sin(sweepAngle) * sweepRadius
          );
          ctx.lineWidth = 1.15;
          ctx.strokeStyle = 'rgba(224, 242, 254, 0.95)';
          ctx.stroke();
          ctx.restore();

          // F. Jeweled Pinpoint Center Core
          ctx.beginPath();
          ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.fill();

          // G. Clean Micro Typography (Station name)
          const cityName = station.name.replace(' (DWR)', '');
          ctx.font = '600 8.5px monospace';
          ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
          ctx.textAlign = 'center';
          ctx.fillText(cityName, sx, sy + sweepRadius + 9);
        });

        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Luminous Big-Ribbon Atmospheric Wind Streamlines in Fast Motion
      // High-momentum fluid dynamics, wide silky strokes and long continuous vapor banners
      const isDarkBg = mapViewRef.current === 'satellite' || selectedWeatherLayerRef.current === 'temp';
      let activeCount = 2400;
      let speedMult = 0.44;
      let fadeRate = 0.028; // Lower fade leaves long, thick, continuous silky ribbons
      let strokeCalm, strokeFine, strokeMid, strokeStrong;
      let widthCalm = 1.30;
      let widthFine = 1.95;
      let widthMid = 3.10;
      let widthStrong = 4.60;

      if (mode === 'strong') {
        activeCount = 3000;
        speedMult = 0.48;
        fadeRate = 0.028;
        widthCalm = 1.50;
        widthFine = 2.25;
        widthMid = 3.40;
        widthStrong = 5.00;
        if (isDarkBg) {
          strokeCalm = 'rgba(205, 235, 255, 0.25)';
          strokeFine = 'rgba(215, 240, 255, 0.54)';
          strokeMid = 'rgba(240, 250, 255, 0.88)';
          strokeStrong = 'rgba(255, 255, 255, 1.0)';
        } else {
          strokeCalm = 'rgba(28, 55, 85, 0.22)';
          strokeFine = 'rgba(25, 52, 80, 0.54)';
          strokeMid = 'rgba(12, 34, 60, 0.88)';
          strokeStrong = 'rgba(4, 16, 32, 1.0)';
        }
      } else if (mode === 'dark') {
        activeCount = 2400;
        speedMult = 0.44;
        fadeRate = 0.028;
        widthCalm = 1.35;
        widthFine = 2.00;
        widthMid = 3.10;
        widthStrong = 4.60;
        strokeCalm = 'rgba(45, 60, 78, 0.22)';
        strokeFine = 'rgba(38, 52, 68, 0.48)';
        strokeMid = 'rgba(18, 30, 44, 0.82)';
        strokeStrong = 'rgba(6, 12, 22, 1.0)';
      } else if (mode === 'fast') {
        // Fast Motion with Big Ribbons
        activeCount = 2600;
        speedMult = 0.58;
        fadeRate = 0.026;
        widthCalm = 1.60;
        widthFine = 2.50;
        widthMid = 3.80;
        widthStrong = 5.60;
        if (isDarkBg) {
          strokeCalm = 'rgba(200, 235, 255, 0.25)';
          strokeFine = 'rgba(215, 242, 255, 0.52)';
          strokeMid = 'rgba(240, 252, 255, 0.88)';
          strokeStrong = 'rgba(255, 255, 255, 1.0)';
        } else {
          strokeCalm = 'rgba(28, 55, 85, 0.22)';
          strokeFine = 'rgba(24, 50, 78, 0.52)';
          strokeMid = 'rgba(12, 34, 60, 0.88)';
          strokeStrong = 'rgba(4, 16, 32, 1.0)';
        }
      } else {
        // 'normal' upgraded with prominent ribbons and energetic fast flow
        if (isDarkBg) {
          strokeCalm = 'rgba(195, 230, 255, 0.20)';
          strokeFine = 'rgba(210, 238, 255, 0.45)';
          strokeMid = 'rgba(235, 248, 255, 0.80)';
          strokeStrong = 'rgba(255, 255, 255, 0.98)';
        } else {
          strokeCalm = 'rgba(32, 60, 90, 0.20)';
          strokeFine = 'rgba(28, 56, 84, 0.48)';
          strokeMid = 'rgba(16, 40, 68, 0.82)';
          strokeStrong = 'rgba(8, 24, 46, 0.98)';
        }
      }

      // Enhanced intensity and fast-motion trail persistence for active Wind Speed layer
      const isWindLayer = selectedWeatherLayer === 'wind';
      if (isWindLayer) {
        activeCount = 2800;
        speedMult = 0.54;
        fadeRate = 0.026;
      }

      // Authentic Ventusky/Windy Ghost Trail Persistence
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeRate})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const width = canvas.width;
      const height = canvas.height;

      const tierCalm = [];     // < 22 km/h (Ice-Cyan)
      const tierModerate = []; // 22-48 km/h (Emerald Green)
      const tierBrisk = [];    // 48-78 km/h (Solar Amber)
      const tierStorm = [];    // >= 78 km/h (Neon Magenta/Crimson)

      const tierCalmMist = []; // < 1.4 km/h normalized (ethereal ambient mist)
      const tierFine = [];     // 1.4 - 2.4 (delicate flow filaments)
      const tierMid = [];      // 2.4 - 4.2 (defined fluid flow corridors)
      const tierStrong = [];   // >= 4.2 (radiant starlight tracers in jetstreams and cyclonic core)

      for (let i = 0; i < activeCount; i++) {
        const currX = p.x[i];
        const currY = p.y[i];

        // --- 2nd-Order Runge-Kutta (RK2 Midpoint) with Physical Velocity Scaling & Land/Water Friction ---
        // 1. Initial State (Stage 0)
        const pos0 = screenToLngLat(currX, currY);
        const cosLat0 = Math.max(0.18, Math.cos((pos0.lat * Math.PI) / 180));
        
        const k1 = getWindVector(pos0.lng, pos0.lat);
        const uNorm1 = k1.u / cosLat0;
        const mag1 = Math.sqrt(uNorm1 * uNorm1 + k1.v * k1.v);

        // Planetary Boundary Layer Aerodynamic Surface Drag (Fast on Water, Slow on Land)
        const fMult1 = getSurfaceFrictionMultiplier(pos0.lng, pos0.lat);
        const factor1 = (mag1 < 0.001) ? (1.0 / 3.5) : (Math.tanh(mag1 / 3.5) / mag1);
        const dispScale1 = Math.max(0.18 / (mag1 + 0.15), 0.14 + 1.25 * factor1) * (speedMult * fMult1) * p.speed[i];

        // Midpoint predictor (half step along tangent)
        const midX = currX + (uNorm1 * dispScale1) * 0.5;
        const midY = currY - (k1.v * dispScale1) * 0.5;

        // 2. Midpoint Evaluation (Stage 1)
        const posMid = screenToLngLat(midX, midY);
        const cosLatMid = Math.max(0.18, Math.cos((posMid.lat * Math.PI) / 180));

        const k2 = getWindVector(posMid.lng, posMid.lat);
        const uNorm2 = k2.u / cosLatMid;
        const mag2 = Math.sqrt(uNorm2 * uNorm2 + k2.v * k2.v);

        // Corrector: advance particle along midpoint tangent with surface drag
        const fMult2 = getSurfaceFrictionMultiplier(posMid.lng, posMid.lat);
        const factor2 = (mag2 < 0.001) ? (1.0 / 3.5) : (Math.tanh(mag2 / 3.5) / mag2);
        const dispScale2 = Math.max(0.18 / (mag2 + 0.15), 0.14 + 1.25 * factor2) * (speedMult * fMult2) * p.speed[i];
        const stepX = uNorm2 * dispScale2;
        const stepY = -k2.v * dispScale2;

        const nextX = currX + stepX;
        const nextY = currY + stepY;

        const lifeRatio = p.age[i] / p.maxAge[i];
        const alpha = Math.sin(lifeRatio * Math.PI);

        // Delta Threshold Clipping & Laminar Flow Minimum Extension:
        // Prevents sub-pixel strokes from stamping round 'pepper dots' when winds are calm over terrain
        const stepDist = Math.sqrt(stepX * stepX + stepY * stepY);
        let finalNextX = nextX;
        let finalNextY = nextY;
        let finalMidX = midX;
        let finalMidY = midY;

        if (stepDist < 1.15) {
          const scale = 1.15 / Math.max(0.001, stepDist);
          finalNextX = currX + stepX * scale;
          finalNextY = currY + stepY * scale;
          finalMidX = currX + (stepX * scale) * 0.5;
          finalMidY = currY + (stepY * scale) * 0.5;
        }

        const dx = nextX - currX;
        const dy = nextY - currY;
        const maxJump = Math.max(20, stepDist * 3.5);

        if (Math.abs(dx) <= maxJump && Math.abs(dy) <= maxJump) {
          if (p.age[i] > 1 && alpha > 0.04) {
            if (isWindLayer) {
              const estSpeedKmh = mag2 * 12.5;
              if (estSpeedKmh >= 78) {
                tierStorm.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY);
              } else if (estSpeedKmh >= 48) {
                tierBrisk.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY);
              } else if (estSpeedKmh >= 22) {
                tierModerate.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY);
              } else {
                tierCalm.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY);
              }
            } else {
              let targetTier = null;
              if (mag2 >= 4.2 && alpha > 0.30) {
                targetTier = tierStrong;
              } else if (mag2 >= 2.4 && alpha > 0.20) {
                targetTier = tierMid;
              } else if (mag2 >= 1.4 && alpha > 0.12) {
                targetTier = tierFine;
              } else if (alpha > 0.25) {
                // Calm air / terrain lee: only drawn when alpha is established, rendered as ultra-delicate mist
                targetTier = tierCalmMist;
              }

              if (targetTier) {
                // Continuous quadratic Bézier curve (curr -> control:mid -> next) eliminates creases and jagged edges
                targetTier.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY);
              }
            }
          }
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
          const spawnX = Math.random() * width;
          const spawnY = Math.random() * height;
          p.x[i] = spawnX;
          p.y[i] = spawnY;
          p.prevX[i] = spawnX;
          p.prevY[i] = spawnY;
          p.age[i] = 0;
          p.maxAge[i] = 70 + Math.floor(Math.random() * 80);
          p.speed[i] = 0.85 + Math.random() * 0.30;
        }
      }

      if (isWindLayer) {
        // Speed-Coded Streamlines (Smooth Curvilinear Bézier Ribbons - Big & Bold)
        const calmColor = isDarkBg ? 'rgba(186, 248, 255, 0.88)' : 'rgba(2, 132, 199, 0.92)';
        const modColor = isDarkBg ? 'rgba(52, 211, 153, 0.94)' : 'rgba(5, 150, 105, 0.94)';
        const briskColor = isDarkBg ? 'rgba(252, 211, 77, 0.98)' : 'rgba(217, 119, 6, 0.98)';
        const stormColor = isDarkBg ? 'rgba(244, 63, 94, 1.0)' : 'rgba(225, 29, 72, 1.0)';

        // 1. Calm / Gentle (< 22 km/h) - Wide Silk Ribbon
        if (tierCalm.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 2.40;
          ctx.strokeStyle = calmColor;
          for (let j = 0; j < tierCalm.length; j += 6) {
            ctx.moveTo(tierCalm[j], tierCalm[j + 1]);
            ctx.quadraticCurveTo(tierCalm[j + 2], tierCalm[j + 3], tierCalm[j + 4], tierCalm[j + 5]);
          }
          ctx.stroke();
        }

        // 2. Moderate (22-48 km/h) - Broad Flow Ribbon
        if (tierModerate.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 3.60;
          ctx.strokeStyle = modColor;
          for (let j = 0; j < tierModerate.length; j += 6) {
            ctx.moveTo(tierModerate[j], tierModerate[j + 1]);
            ctx.quadraticCurveTo(tierModerate[j + 2], tierModerate[j + 3], tierModerate[j + 4], tierModerate[j + 5]);
          }
          ctx.stroke();
        }

        // 3. Fresh / Strong (48-78 km/h) - Power Corridor Ribbon
        if (tierBrisk.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 5.00;
          ctx.strokeStyle = briskColor;
          for (let j = 0; j < tierBrisk.length; j += 6) {
            ctx.moveTo(tierBrisk[j], tierBrisk[j + 1]);
            ctx.quadraticCurveTo(tierBrisk[j + 2], tierBrisk[j + 3], tierBrisk[j + 4], tierBrisk[j + 5]);
          }
          ctx.stroke();
        }

        // 4. Gale / Storm / Cyclone (>= 78 km/h) - Grand Jetstream Banner
        if (tierStorm.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 6.80;
          ctx.strokeStyle = stormColor;
          for (let j = 0; j < tierStorm.length; j += 6) {
            ctx.moveTo(tierStorm[j], tierStorm[j + 1]);
            ctx.quadraticCurveTo(tierStorm[j + 2], tierStorm[j + 3], tierStorm[j + 4], tierStorm[j + 5]);
          }
          ctx.stroke();
        }
      } else {
        // Multi-Depth Silk Ribbons:
        // 0. Calm Mist: Ethereal ambient mist in stagnant / calm zones (eliminates pepper dots)
        if (tierCalmMist.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = widthCalm;
          ctx.strokeStyle = strokeCalm;
          for (let j = 0; j < tierCalmMist.length; j += 6) {
            ctx.moveTo(tierCalmMist[j], tierCalmMist[j + 1]);
            ctx.quadraticCurveTo(tierCalmMist[j + 2], tierCalmMist[j + 3], tierCalmMist[j + 4], tierCalmMist[j + 5]);
          }
          ctx.stroke();
        }

        // 1. Whispers: Delicate background streamlines (translucent ambient silk mist)
        if (tierFine.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = widthFine;
          ctx.strokeStyle = strokeFine;
          for (let j = 0; j < tierFine.length; j += 6) {
            ctx.moveTo(tierFine[j], tierFine[j + 1]);
            ctx.quadraticCurveTo(tierFine[j + 2], tierFine[j + 3], tierFine[j + 4], tierFine[j + 5]);
          }
          ctx.stroke();
        }

        // 2. Streamlines: Defined fluid flow corridors (soft pearl white)
        if (tierMid.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = widthMid;
          ctx.strokeStyle = strokeMid;
          for (let j = 0; j < tierMid.length; j += 6) {
            ctx.moveTo(tierMid[j], tierMid[j + 1]);
            ctx.quadraticCurveTo(tierMid[j + 2], tierMid[j + 3], tierMid[j + 4], tierMid[j + 5]);
          }
          ctx.stroke();
        }

        // 3. Tracers: Crisp luminous foreground streaks (radiant starlight tracers in high momentum flows)
        if (tierStrong.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = widthStrong;
          ctx.strokeStyle = strokeStrong;
          for (let j = 0; j < tierStrong.length; j += 6) {
            ctx.moveTo(tierStrong[j], tierStrong[j + 1]);
            ctx.quadraticCurveTo(tierStrong[j + 2], tierStrong[j + 3], tierStrong[j + 4], tierStrong[j + 5]);
          }
          ctx.stroke();
        }
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
      map.off('movestart', clearCanvasTrails);
      map.off('zoomstart', clearCanvasTrails);
      map.off('move', onMapMove);
      map.off('zoom', onMapMove);
      map.off('moveend', onMapMove);
      map.off('zoomend', onMapMove);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [showParticles, windParticleMode, selectedWeatherLayer]);


  // Real-time hover cursor coordinate, temperature & windspeed probe tracking (throttled at 60fps)
  // Real-time hover cursor coordinate tracking (throttled at 60fps)
  const handleMouseMove = useCallback((e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (mouseMoveRafRef.current) return;
    mouseMoveRafRef.current = requestAnimationFrame(() => {
      mouseMoveRafRef.current = null;
      const map = mapRef.current;
      if (!map) return;
      const container = mapContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        setHoverCoords(null);
        return;
      }

      try {
        const lngLat = map.unproject([x, y]);
        setHoverCoords({
          lat: lngLat.lat,
          lon: lngLat.lng,
          x,
          y
        });
      } catch (err) {}
    });
  }, []);

  // Update hover coordinates when user scrolls mouse wheel over the map
  const handleWheel = useCallback((e) => {
    const container = mapContainerRef.current;
    const map = mapRef.current;
    if (!container || !map) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      try {
        const lngLat = map.unproject([x, y]);
        setHoverCoords({
          lat: lngLat.lat,
          lon: lngLat.lng,
          x,
          y
        });
      } catch (err) {}
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverCoords(null);
  }, []);

  // Active Tropical Cyclone Systems
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    cycloneMarkersRef.current.forEach(m => m.remove());
    cycloneMarkersRef.current = [];

    // Fetch live cyclones on mount
    fetchLiveCyclones().catch(() => {});

    const updateCycloneMarkers = (cyclones) => {
      cycloneMarkersRef.current.forEach(m => m.remove());
      cycloneMarkersRef.current = [];

      (cyclones || []).forEach(cyclone => {
        const el = document.createElement('div');
        el.className = 'custom-cyclone-marker flex items-center gap-1.5 apple-liquid-glass px-2.5 py-1 rounded-full shadow-2xl cursor-pointer select-none transition-transform hover:scale-110 active:scale-95 border border-white/20 pointer-events-auto';
        el.title = `${cyclone.name} (${cyclone.status || cyclone.category}) — Wind: ${cyclone.windKmh} km/h, Pressure: ${cyclone.pressureHpa} hPa`;
        el.innerHTML = `
          <span class="w-4 h-4 flex items-center justify-center animate-spin text-rose-400" style="animation-duration: 3.5s;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3.5 h-3.5 text-rose-400">
              <path d="M12 2a10 10 0 0 1 7.07 17.07l-2.12-2.12A7 7 0 0 0 12 5v-3z"/>
              <path d="M12 22a10 10 0 0 1-7.07-17.07l2.12 2.12A7 7 0 0 0 12 19v3z"/>
            </svg>
          </span>
          <span class="text-[11px] font-bold text-white tracking-wide">${cyclone.name}</span>
          <span class="text-[9px] font-mono px-1 rounded bg-rose-500/30 text-rose-300 font-semibold">${cyclone.windKmh}k</span>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          map.flyTo({
            center: [cyclone.lon, cyclone.lat],
            zoom: 5.5,
            speed: 1.2
          });
          setPinAtCoords(cyclone.lon, cyclone.lat, cyclone.name);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([cyclone.lon, cyclone.lat])
          .addTo(map);

        cycloneMarkersRef.current.push(marker);
      });
    };

    const unsubscribe = subscribeActiveCyclones(updateCycloneMarkers);

    return () => {
      unsubscribe();
      cycloneMarkersRef.current.forEach(m => m.remove());
      cycloneMarkersRef.current = [];
    };
  }, [setPinAtCoords]);

  // Update clicked pin screen position on map pan/zoom/rotate so it stays anchored to geographical coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMapChange = () => {
      if (!clickedPinRef.current) return;
      try {
        const pt = map.project([clickedPinRef.current.lon, clickedPinRef.current.lat]);
        setClickedPinScreenPos({ x: pt.x, y: pt.y });
        clickedPinScreenPosRef.current = { x: pt.x, y: pt.y };
      } catch (err) {}
    };

    map.on('move', onMapChange);
    map.on('zoom', onMapChange);
    return () => {
      map.off('move', onMapChange);
      map.off('zoom', onMapChange);
    };
  }, []);

  // Click on map to drop a pin and inspect temperature & coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMapClick = (e) => {
      const { lng, lat } = e.lngLat;
      const { x, y } = e.point;

      setPinAtCoords(lng, lat);

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
          temp: getCachedPointTemperature(lat, lng),
          windSpeed: getLocalWindSpeed(lng, lat)
        });

        const zoom = Math.round(map.getZoom());
        getLiveTemperature(lat, lng, zoom).then((realTemp) => {
          if (realTemp != null) {
            onSelectStation((prev) => (prev && prev.lat === lat && prev.lon === lng ? { ...prev, temp: realTemp } : prev));
          }
        });
      }
    };

    map.on('click', onMapClick);
    return () => map.off('click', onMapClick);
  }, [setPinAtCoords, onSelectStation]);

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
      setPinAtCoords(selectedStation.lon, selectedStation.lat, selectedStation.name);
      renderStationMarkers(mapRef.current);
    }
  }, [selectedStation, is3D, setPinAtCoords, renderStationMarkers]);

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


      {/* 1. MapLibre GL JS WebGL Canvas Container */}
      <div 
        ref={mapContainerRef} 
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-full z-[1]" 
      />

      {tileError && (
        (tileError.scope === 'base' ||
          (tileError.scope === 'map' && tileError.mapView === mapView) ||
          (tileError.scope === 'layer' && tileError.layer === selectedWeatherLayer)) && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-14 left-1/2 z-40 -translate-x-1/2 rounded-full border border-amber-300/30 bg-slate-950/90 px-3 py-1.5 text-center text-[11px] font-medium text-amber-100 shadow-xl"
        >
          {tileError.message}
        </div>
        )
      )}

      {/* 2. Streamline particles (hardware-composited on top of heatmap at 120 FPS) */}
      <canvas
        ref={particleCanvasRef}
        className="pointer-events-none absolute inset-0 z-[10] w-full h-full transition-opacity duration-150"
        style={{
          opacity: ((showParticles && windParticleMode !== 'off') || selectedWeatherLayer === 'wind' || selectedWeatherLayer === 'temp' || selectedWeatherLayer === 'precip')
            ? 1
            : 0,
          pointerEvents: 'none'
        }}
      />

      {/* 2.2 Hover Cursor Indicator (Shows coordinates & live radar reflectivity probe) */}
      {hoverCoords && (
        <div
          className="pointer-events-none absolute z-[15] -translate-x-1/2 -translate-y-[calc(100%+8px)] transition-transform duration-75 select-none"
          style={{
            left: `${hoverCoords.x}px`,
            top: `${hoverCoords.y}px`
          }}
        >
          <div className="apple-liquid-glass px-2.5 py-1 rounded-lg shadow-lg border border-white/20 bg-slate-950/85 backdrop-blur-md text-slate-200 text-[10px] font-mono tracking-tight flex items-center gap-1.5 whitespace-nowrap">
            <span>
              {Math.abs(hoverCoords.lat).toFixed(2)}°{hoverCoords.lat >= 0 ? 'N' : 'S'}, {Math.abs(hoverCoords.lon).toFixed(2)}°{hoverCoords.lon >= 0 ? 'E' : 'W'}
            </span>
            {selectedWeatherLayer === 'precip' && (() => {
              const rainRate = estimateLocalRainRate(hoverCoords.lon, hoverCoords.lat, { cyclones: getActiveCyclones(), cloudburstEvent });
              const dbz = getLocalRadarDbz(hoverCoords.lon, hoverCoords.lat, rainRate);
              const probe = getRadarProbeInfo(dbz, rainRate);
              return (
                <span className="flex items-center gap-1.5 pl-1.5 border-l border-white/15">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: probe.color }} />
                  <span style={{ color: probe.color }} className="font-semibold">{probe.label}</span>
                  {probe.dbz > 0 && <span className="text-slate-400">({probe.dbz} dBZ)</span>}
                </span>
              );
            })()}
          </div>
          <div className="w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-slate-900/80 mx-auto" />
        </div>
      )}

      {/* 2.3 Clicked Pin with Live Temperature */}
      {clickedPin && clickedPinScreenPos && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-full transition-transform duration-75 select-none pointer-events-auto"
          style={{
            left: `${clickedPinScreenPos.x}px`,
            top: `${clickedPinScreenPos.y}px`
          }}
        >
          {/* Temperature Popup Bubble */}
          <div className="relative mb-1 flex items-center gap-2.5 apple-liquid-glass px-3 py-1.5 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.65)] border border-white/25 bg-slate-950/90 backdrop-blur-md text-white min-w-[130px]">
            {/* Temperature Badge */}
            <div className="flex items-center gap-1.5 shrink-0">
              {clickedPin.loading ? (
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              ) : (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: getTempColorHex(clickedPin.temp) }}
                />
              )}
              <span className="text-xs font-bold text-white font-sans">
                {clickedPin.loading ? '...' : formatTemperature(clickedPin.temp, tempUnit)}
              </span>
            </div>

            {/* Location & Coordinates */}
            <div className="flex flex-col text-[9px] font-mono leading-tight">
              <span className="font-semibold text-slate-200 truncate max-w-[95px]">{clickedPin.name}</span>
              <span className="text-slate-400">
                {clickedPin.lat.toFixed(2)}°, {clickedPin.lon.toFixed(2)}°
              </span>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                setClickedPin(null);
                setClickedPinScreenPos(null);
              }}
              className="ml-auto p-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer rounded hover:bg-white/10"
              title="Remove pin"
              aria-label="Remove pin"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Map Pin Teardrop & Ground Needle */}
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-cyan-500 border-2 border-white shadow-lg flex items-center justify-center text-slate-950 drop-shadow-md">
              <MapPin className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="w-0.5 h-2 bg-white/90 shadow" />
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 ring-2 ring-white/80 animate-ping" />
          </div>
        </div>
      )}

      {/* 2.5 Weather Overlay Layer Floating Pill Bar */}
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
        ].map((item) => {
          const Icon = item.icon;
          const isActive = selectedWeatherLayer === item.id;
          const isItemLoading = item.id === 'temp' && isActive && isTempLoading;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectWeatherLayer(item.id)}
              onPointerEnter={() => {
                if (item.id === 'temp') preloadTemperatureEngine();
              }}
              onFocus={() => {
                if (item.id === 'temp') preloadTemperatureEngine();
              }}
              title={`Toggle ${item.label} Overlay`}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'apple-liquid-glass-amber text-amber-200 border border-amber-400/50 shadow-md scale-105'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {isItemLoading ? (
                <Loader2 className="w-3 h-3 text-amber-300 animate-spin" />
              ) : (
                <Icon className="w-3 h-3" />
              )}
              <span>{item.label}</span>
            </button>
          );
        })}

        {selectedWeatherLayer !== 'none' && (
          <button
            type="button"
            onClick={() => handleSelectWeatherLayer('none')}
            title="Hide all weather overlay layers"
            aria-label="Hide all weather overlay layers"
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {selectedWeatherLayer === 'convective' && mapView !== 'satellite' && (
          <span
            title="Illustrative model output, not an official forecast or warning"
            className="shrink-0 rounded-full border border-amber-300/30 px-2 py-1 text-[9px] font-semibold text-amber-100"
          >
            Illustrative model · not an official forecast
          </span>
        )}
      </div>



      {/* 5. Clean Basic Map Navigation Controls */}
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
            const nextMuted = !isThunderMuted;
            thunderSynth.setMuted(nextMuted);
            setIsThunderMuted(nextMuted);
            if (!nextMuted) {
              thunderSynth.play();
            }
          }}
          title={isThunderMuted ? "Enable Muted Thunder Audio" : "Mute Thunder Audio (Currently Active)"}
          className={`p-2 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
            isThunderMuted 
              ? 'text-slate-400 hover:text-white hover:bg-white/15' 
              : 'text-amber-300 bg-amber-400/20 border border-amber-400/50 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
          }`}
        >
          {isThunderMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
          <span className="text-[10px] tracking-wider font-semibold">IND</span>
        </button>
      </div>

      {/* Bottom Left Dynamic Scale Indicator */}
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
    </div>
  );
}
