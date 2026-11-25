import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(maplibreWorkerUrl);
import {
  Plus,
  Minus,
  Zap,
  Thermometer,
  CloudRain,
  Wind,
  Volume2,
  VolumeX,
  X,
  MapPin,
  Loader2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Compass,
  Activity,
  ShieldAlert,
  Navigation,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { STATIONS_NETWORK } from '../data/cloudburstData';
import { getCachedMLRisk } from '../services/mlPredictionService';
import { getOrFetchRadarMetadata } from '../cache/index.js';
import { isIndiaSector } from '../utils/geoUtils';
import {
  celsiusToFahrenheit,
  computeGlobalThermodynamicTemp,
  computeGlobalWindSpeed,
  getWindSpeedColor,
  getWindSpeedCategory,
  getTempColorHex,
  getThermalCategory,
  formatTemperature,
  getLiveTemperature,
  getCachedPointTemperature,
  preloadTemperatureEngine,
  getBeaufortScaleInfo,
  estimateWindGust,
  getWindDirectionCompass,
  WIND_ART_PALETTES
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
import { getPlanetaryIsothermsGeoJSON } from '../utils/isothermGeoJson';
import { getPlanetaryIsotachsGeoJSON } from '../utils/isotachGeoJson';
import {
  WEATHER_LAYERS,
  getWeatherApiTileUrl,
  getWeatherApiTimestamp,
  RADAR_SCHEMES,
  RADAR_ART_PALETTES,
  getRainViewerTileUrl
} from '../utils/weatherTiles';
import { getWindParticleStyle } from '../utils/windParticleStyles';
import { sampleAeroSilkVector } from '../services/aeroSilkService';
import {
  getLocalRadarDbz,
  getRadarProbeInfo,
  estimateLocalRainRate,
  RADAR_COVERAGE_CENTERS,
  RADAR_DBZ_STOPS,
  RADAR_COVERAGE_DISKS_GEOJSON,
  RADAR_RANGE_RINGS_GEOJSON,
  generateActiveRadarReflectivityGeoJSON
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
import {
  getLiveAirQualityNetwork,
  getCachedAQI,
  getAqiCategory,
  getAqiCacheMinutesRemaining
} from '../services/aqiService';
import { generateAqiAtmosphericGeoJSON, getPlanetaryIsoAqiGeoJSON } from '../utils/aqiMeshGeoJson';
import { computeInterpolatedAqi } from '../utils/aqiTiles';
import AqiLegendBar from './AqiLegendBar';
import TemperatureLegendBar from './TemperatureLegendBar';

export const SATELLITE_TILES = [
  'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
];

const LIBERTY_STYLE_URL = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';
const LIBERTY_LAYER_PREFIX = 'liberty-';
let libertyStyleCache = null;
let libertyStylePromise = null;

// Rich dark-green satellite-biome palette overrides for VersaTiles Colorful
const VERSATILES_DARK_GREEN_PAINT = {
  background: { 'background-color': '#3a5a40' },
  'landcover-land-forest': { 'fill-color': '#234f36' },
  'landcover-land-grass': { 'fill-color': '#2f6342' },
  'landcover-land-vegetation': { 'fill-color': '#386b49' },
  'landcover-land-agriculture': { 'fill-color': '#42734f' },
  'landcover-land-wetland': { 'fill-color': '#2b5e57' },
  'landcover-land-residential': { 'fill-color': '#4e6353' },
  'landcover-land-rock': { 'fill-color': '#525e54' },
  'landcover-land-glacier': { 'fill-color': '#ffffff' },
  'land-forest': { 'fill-color': '#234f36' },
  'land-grass': { 'fill-color': '#2f6342' },
  'land-vegetation': { 'fill-color': '#386b49' },
  'land-agriculture': { 'fill-color': '#42734f' },
  'land-park': { 'fill-color': '#2f6342' },
  'land-garden': { 'fill-color': '#2f6342' },
  'land-glacier': { 'fill-color': '#ffffff' },
  'landcover-water-area': { 'fill-color': '#1d5fa3' },
  'water-ocean': { 'fill-color': '#1d5fa3' },
};

function fetchLibertyVectorStyle() {
  if (libertyStyleCache) return Promise.resolve(libertyStyleCache);
  if (!libertyStylePromise) {
    libertyStylePromise = fetch(LIBERTY_STYLE_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.sources && Array.isArray(data?.layers)) {
          libertyStyleCache = {
            sources: data.sources,
            layers: data.layers
              .filter((l) => l.type !== 'symbol')
              .map((l) => {
                const override = VERSATILES_DARK_GREEN_PAINT[l.id];
                return override ? { ...l, paint: { ...(l.paint || {}), ...override } } : l;
              }),
          };
        }
        return libertyStyleCache;
      })
      .catch(() => null);
  }
  return libertyStylePromise;
}

function syncLibertyVectorBasemap(map, isVisible) {
  if (!map || !map.getStyle() || !libertyStyleCache) return false;
  const { sources, layers } = libertyStyleCache;

  for (const [sourceId, sourceDef] of Object.entries(sources)) {
    if (!map.getSource(sourceId)) {
      try {
        map.addSource(sourceId, sourceDef);
      } catch (e) { }
    }
  }

  const anchorId = map.getLayer('basemap') ? 'basemap' : undefined;
  const vis = isVisible ? 'visible' : 'none';

  for (const layer of layers) {
    const id = `${LIBERTY_LAYER_PREFIX}${layer.id}`;
    if (!map.getLayer(id)) {
      try {
        map.addLayer(
          {
            ...layer,
            id,
            layout: {
              ...(layer.layout || {}),
              visibility: vis,
            },
          },
          anchorId
        );
      } catch (e) { }
    } else {
      try {
        map.setLayoutProperty(id, 'visibility', vis);
      } catch (e) { }
    }
  }
  return true;
}

const BASEMAP_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    basemap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    },
    'satellite-source': {
      type: 'raster',
      tiles: SATELLITE_TILES,
      tileSize: 256,
      maxzoom: 20,
      attribution: '&copy; Google Imagery'
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
      id: 'base-satellite',
      type: 'raster',
      source: 'satellite-source',
      layout: {
        visibility: 'none'
      },
      paint: {
        'raster-opacity': 0.0,
        'raster-fade-duration': 0,
        'raster-resampling': 'linear'
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

// AeroSilk™ Real-Time Atmospheric Vector Field Engine
// Evaluates real-world GFS / ECMWF wind vector grid with continuous bilinear spatial interpolation,
// multi-altitude pressure levels (Surface, 850 hPa, 250 hPa), and live GDACS / NOAA cyclone vortexes.
function getWindVector(lon, lat, timeOffsetHours = 0, altitudeLevel = 'surface') {
  const vec = sampleAeroSilkVector(lon, lat, timeOffsetHours, altitudeLevel);
  return { u: vec.u, v: vec.v, mag: vec.speed, vorticity: vec.vorticity };
}

function getLocalTemperature(lon, lat) {
  return getCachedPointTemperature(lat, lon);
}

function getLocalWindSpeed(lon, lat, altitudeLevel = 'surface') {
  const vec = getWindVector(lon, lat, 0, altitudeLevel);
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
      } catch (err) { }
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
      } catch (e) { }
    }
  }
}

/**
 * Configure MapLibre GL JS Built-in Heatmap Layer, WeatherAPI Raster Tiles & Satellite Source
 */
function applyMapLayersAndHeatmap(
  map,
  isSatellite,
  activeLayer = 'temp',
  isHeatmapVisible = true,
  heatmapGeoJSON = null,
  radarTimestampPath = null,
  cloudburstEvent = null,
  radarScheme = 'nordic',
  isRadarBoosted = true,
  showRadarRings = true,
  dynamicCyclones = [],
  stations = [],
  aqiGeoJSON = null,
  showIsotachs = true
) {
  if (!map || !map.getStyle()) return;

  // 1. High-Resolution Global Satellite Raster Source with Google Hybrid tiles
  if (map.getSource('esri-satellite')) {
    if (map.getLayer('base-satellite')) {
      try { map.removeLayer('base-satellite'); } catch (_) { }
    }
    try { map.removeSource('esri-satellite'); } catch (_) { }
  }

  if (!map.getSource('satellite-source')) {
    map.addSource('satellite-source', {
      type: 'raster',
      tiles: SATELLITE_TILES,
      tileSize: 256,
      maxzoom: 20,
      attribution: '&copy; Google Imagery'
    });
  }

  // Find layer before which to place satellite raster, WeatherAPI tiles & heatmap (under place labels and boundaries)
  const styleLayers = map.getStyle()?.layers || [];
  const firstLabelLayer = styleLayers.find(
    (l) => l.id === 'boundary_3' || l.id === 'boundary_2' || l.type === 'symbol'
  );
  const beforeId = firstLabelLayer ? firstLabelLayer.id : undefined;

  // 1.5 Dynamic 3-Mode Basemap Switching:
  // - Satellite ON: Google Hybrid satellite raster
  // - Weather overlay active ('temp', 'wind', 'precip', 'aqi'): Clean whitish OSM map
  // - Else ('convective' or 'none'): Dark-green VersaTiles Colorful vector map
  const isWeatherOverlay = activeLayer === 'temp' || activeLayer === 'wind' || activeLayer === 'precip' || activeLayer === 'aqi';
  const isGreenVectorMap = !isSatellite && !isWeatherOverlay;
  map.__bwUseGreenVector = isGreenVectorMap;

  let libertyReady = false;
  if (isGreenVectorMap || libertyStyleCache) {
    if (libertyStyleCache) {
      libertyReady = syncLibertyVectorBasemap(map, isGreenVectorMap);
    } else if (isGreenVectorMap) {
      fetchLibertyVectorStyle().then((loaded) => {
        if (!loaded || !map.getStyle()) return;
        const stillGreen = Boolean(map.__bwUseGreenVector);
        syncLibertyVectorBasemap(map, stillGreen);
        if (stillGreen && map.getLayer('basemap')) {
          try {
            map.setLayoutProperty('basemap', 'visibility', 'none');
            map.setPaintProperty('basemap', 'raster-opacity', 0.0);
          } catch (e) { }
        }
      });
    }
  }

  if (map.getLayer('basemap')) {
    const hideOsmBasemap = isSatellite || (isGreenVectorMap && libertyReady);
    try {
      map.setLayoutProperty('basemap', 'visibility', hideOsmBasemap ? 'none' : 'visible');
      map.setPaintProperty('basemap', 'raster-brightness-min', 0.0);
      map.setPaintProperty('basemap', 'raster-brightness-max', 1.0);
      map.setPaintProperty('basemap', 'raster-contrast', 0.0);
      map.setPaintProperty('basemap', 'raster-saturation', isWeatherOverlay ? -0.35 : 0.0);
      map.setPaintProperty('basemap', 'raster-opacity', hideOsmBasemap ? 0.0 : 1.0);
    } catch (e) { }
  }

  // 2. Base Satellite Layer
  if (!map.getLayer('base-satellite')) {
    map.addLayer({
      id: 'base-satellite',
      type: 'raster',
      source: 'satellite-source',
      layout: {
        visibility: isSatellite ? 'visible' : 'none'
      },
      paint: {
        'raster-opacity': isSatellite ? 1.0 : 0.0,
        'raster-fade-duration': 0,
        'raster-resampling': 'linear'
      }
    }, 'basemap');
  } else {
    map.setLayoutProperty('base-satellite', 'visibility', isSatellite ? 'visible' : 'none');
    map.setPaintProperty('base-satellite', 'raster-opacity', isSatellite ? 1.0 : 0.0);
  }

  // Clean up any conflicting legacy WeatherAPI precip raster layer
  if (map.getLayer('weatherapi-precip-layer')) {
    map.removeLayer('weatherapi-precip-layer');
  }
  if (map.getSource('weatherapi-precip-source')) {
    map.removeSource('weatherapi-precip-source');
  }

  // 3. Continuous Weather Raster Layers (Temperature, Wind Speed, Continuous AQI)
  const weatherRasterKeys = ['temp', 'wind', 'aqi'];
  weatherRasterKeys.forEach((key) => {
    const cfg = WEATHER_LAYERS[key];
    if (!cfg) return;

    // Clean up any stale openmeteo source
    if (map.getSource('openmeteo-temp-source')) {
      if (map.getLayer('openmeteo-temp-layer')) map.removeLayer('openmeteo-temp-layer');
      map.removeSource('openmeteo-temp-source');
    }

    const tileUrl = getWeatherApiTileUrl(cfg.layerKey);

    if (!map.getSource(cfg.sourceId)) {
      map.addSource(cfg.sourceId, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: cfg.tileSize || 256,
        minzoom: 0,
        maxzoom: 14,
        attribution: '&copy; BurstWatch'
      });
    } else if (key === 'wind') {
      const src = map.getSource(cfg.sourceId);
      if (src && 'setTiles' in src && typeof src.setTiles === 'function') {
        try {
          src.setTiles([tileUrl]);
        } catch (e) { }
      }
    }

    const isThisRasterVisible = activeLayer === key;
    const rasterLayoutVisibility = isThisRasterVisible ? 'visible' : 'none';

    if (!map.getLayer(cfg.layerId)) {
      map.addLayer({
        id: cfg.layerId,
        type: 'raster',
        source: cfg.sourceId,
        layout: {
          visibility: rasterLayoutVisibility
        },
        paint: {
          'raster-opacity': isThisRasterVisible ? (cfg.opacity ?? 0.88) : 0.0,
          'raster-fade-duration': 200,
          'raster-resampling': 'linear'
        }
      }, beforeId);
    } else {
      map.setLayoutProperty(cfg.layerId, 'visibility', rasterLayoutVisibility);
      try {
        map.setPaintProperty(cfg.layerId, 'raster-opacity', isThisRasterVisible ? (cfg.opacity ?? 0.88) : 0.0);
        map.setPaintProperty(cfg.layerId, 'raster-fade-duration', 200);
        map.setPaintProperty(cfg.layerId, 'raster-resampling', 'linear');
      } catch (e) { }
    }
  });

  // 3.5. Synoptic Labeled Isotherm Contours (Ventusky & Windy Style)
  const isTempVisible = activeLayer === 'temp';
  const isothermGeoJSON = getPlanetaryIsothermsGeoJSON();
  if (!map.getSource('planetary-isotherms-source')) {
    map.addSource('planetary-isotherms-source', {
      type: 'geojson',
      data: isothermGeoJSON
    });
  } else {
    map.getSource('planetary-isotherms-source').setData(isothermGeoJSON);
  }

  // Soft glow aura beneath the line
  if (!map.getLayer('planetary-isotherms-glow')) {
    map.addLayer({
      id: 'planetary-isotherms-glow',
      type: 'line',
      source: 'planetary-isotherms-source',
      layout: {
        'visibility': isTempVisible ? 'visible' : 'none',
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'isMajor'], 3.2, 1.8],
        'line-blur': 2.0,
        'line-opacity': ['case', ['get', 'isMajor'], 0.32, 0.16]
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('planetary-isotherms-glow', 'visibility', isTempVisible ? 'visible' : 'none');
  }

  // Razor-sharp core line (Solid for major 10° steps, dashed for intermediate 5° steps)
  if (!map.getLayer('planetary-isotherms-core')) {
    map.addLayer({
      id: 'planetary-isotherms-core',
      type: 'line',
      source: 'planetary-isotherms-source',
      layout: {
        'visibility': isTempVisible ? 'visible' : 'none',
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'isMajor'], 1.15, 0.70],
        'line-dasharray': ['case', ['get', 'isMajor'], ['literal', [1, 0]], ['literal', [4, 3]]],
        'line-opacity': ['case', ['get', 'isMajor'], 0.85, 0.50]
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('planetary-isotherms-core', 'visibility', isTempVisible ? 'visible' : 'none');
  }

  // Inline typographic numeric labels along the contour curves (e.g. "0°", "10°", "20°", "30°")
  if (!map.getLayer('planetary-isotherms-labels')) {
    map.addLayer({
      id: 'planetary-isotherms-labels',
      type: 'symbol',
      source: 'planetary-isotherms-source',
      layout: {
        'visibility': isTempVisible ? 'visible' : 'none',
        'symbol-placement': 'line',
        'symbol-spacing': 350,
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          3, 9.5,
          6, 11.5,
          9, 13.0
        ],
        'text-allow-overlap': false,
        'text-ignore-placement': false
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(15, 23, 42, 0.95)',
        'text-halo-width': 1.8,
        'text-halo-blur': 0.8,
        'text-opacity': 0.92
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('planetary-isotherms-labels', 'visibility', isTempVisible ? 'visible' : 'none');
  }

  // Clean up any stale legacy isotherm layers
  ['isotherm-contours-glow', 'isotherm-contours-line'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource('isotherm-contours-source')) {
    map.removeSource('isotherm-contours-source');
  }

  // 3.55 Synoptic Labeled Isotach Contours (AeroAtelier™ Wind Speed Horizons)
  const isWindVisible = activeLayer === 'wind' && showIsotachs;
  const isotachGeoJSON = getPlanetaryIsotachsGeoJSON('surface');
  if (!map.getSource('planetary-isotachs-source')) {
    map.addSource('planetary-isotachs-source', {
      type: 'geojson',
      data: isotachGeoJSON
    });
  } else {
    map.getSource('planetary-isotachs-source').setData(isotachGeoJSON);
  }

  // Soft glow aura beneath the line
  if (!map.getLayer('planetary-isotachs-glow')) {
    map.addLayer({
      id: 'planetary-isotachs-glow',
      type: 'line',
      source: 'planetary-isotachs-source',
      layout: {
        'visibility': isWindVisible ? 'visible' : 'none',
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'isMajor'], 3.2, 1.8],
        'line-blur': 2.0,
        'line-opacity': ['case', ['get', 'isMajor'], 0.35, 0.18]
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('planetary-isotachs-glow', 'visibility', isWindVisible ? 'visible' : 'none');
  }

  // Core line (solid for major 50, 100, 140 km/h, dashed for 25, 75 km/h)
  if (!map.getLayer('planetary-isotachs-core')) {
    map.addLayer({
      id: 'planetary-isotachs-core',
      type: 'line',
      source: 'planetary-isotachs-source',
      layout: {
        'visibility': isWindVisible ? 'visible' : 'none',
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'isMajor'], 1.15, 0.70],
        'line-dasharray': ['case', ['get', 'isMajor'], ['literal', [1, 0]], ['literal', [4, 3]]],
        'line-opacity': ['case', ['get', 'isMajor'], 0.85, 0.50]
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('planetary-isotachs-core', 'visibility', isWindVisible ? 'visible' : 'none');
  }

  // Inline typographic numeric labels along the contour curves
  if (!map.getLayer('planetary-isotachs-labels')) {
    map.addLayer({
      id: 'planetary-isotachs-labels',
      type: 'symbol',
      source: 'planetary-isotachs-source',
      layout: {
        'visibility': isWindVisible ? 'visible' : 'none',
        'symbol-placement': 'line',
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          3, 9.0,
          6, 11.0,
          9, 12.5
        ],
        'text-letter-spacing': 0.08,
        'text-max-angle': 30,
        'symbol-spacing': 350,
        'text-keep-upright': true,
        'text-allow-overlap': false,
        'text-ignore-placement': false
      },
      paint: {
        'text-color': '#f8fafc',
        'text-halo-color': ['get', 'halo'],
        'text-halo-width': 2.0,
        'text-halo-blur': 0.8,
        'text-opacity': 0.92
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('planetary-isotachs-labels', 'visibility', isWindVisible ? 'visible' : 'none');
  }

  // 3.6. Planetary Synoptic Iso-AQI Contours (AetherAura™ Thermodynamic Style)
  const isAqiVisible = activeLayer === 'aqi';
  const isoAqiGeoJSON = getPlanetaryIsoAqiGeoJSON();
  if (!map.getSource('planetary-aqi-source')) {
    map.addSource('planetary-aqi-source', {
      type: 'geojson',
      data: isoAqiGeoJSON
    });
  } else {
    map.getSource('planetary-aqi-source').setData(isoAqiGeoJSON);
  }

  // Soft glow aura beneath the Iso-AQI line
  if (!map.getLayer('planetary-aqi-glow')) {
    map.addLayer({
      id: 'planetary-aqi-glow',
      type: 'line',
      source: 'planetary-aqi-source',
      layout: {
        'visibility': isAqiVisible ? 'visible' : 'none',
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'isMajor'], 3.6, 2.0],
        'line-blur': 2.2,
        'line-opacity': ['case', ['get', 'isMajor'], 0.38, 0.20]
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('planetary-aqi-glow', 'visibility', isAqiVisible ? 'visible' : 'none');
  }

  // Razor-sharp core filament
  if (!map.getLayer('planetary-aqi-core')) {
    map.addLayer({
      id: 'planetary-aqi-core',
      type: 'line',
      source: 'planetary-aqi-source',
      layout: {
        'visibility': isAqiVisible ? 'visible' : 'none',
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'isMajor'], 1.25, 0.75],
        'line-dasharray': ['case', ['get', 'isMajor'], ['literal', [1, 0]], ['literal', [4, 3]]],
        'line-opacity': ['case', ['get', 'isMajor'], 0.88, 0.55]
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('planetary-aqi-core', 'visibility', isAqiVisible ? 'visible' : 'none');
  }

  // Inline typographic numeric labels along the contour curves ("50", "100", "150", "200", "300")
  if (!map.getLayer('planetary-aqi-labels')) {
    map.addLayer({
      id: 'planetary-aqi-labels',
      type: 'symbol',
      source: 'planetary-aqi-source',
      layout: {
        'visibility': isAqiVisible ? 'visible' : 'none',
        'symbol-placement': 'line',
        'symbol-spacing': 380,
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          3, 9.5,
          6, 11.5,
          9, 13.0
        ],
        'text-allow-overlap': false,
        'text-ignore-placement': false
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(15, 23, 42, 0.95)',
        'text-halo-width': 1.8,
        'text-halo-blur': 0.8,
        'text-opacity': 0.92
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('planetary-aqi-labels', 'visibility', isAqiVisible ? 'visible' : 'none');
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
  ['ventusky-radar-plume-layer', 'radar-dark-base-layer', 'radar-dark-ref-layer', 'radar-echo-purple', 'radar-echo-red', 'radar-echo-orange', 'radar-echo-yellow', 'radar-echo-green', 'radar-echo-cyan', 'radar-echo-blue'].forEach((id) => {
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

  // B. DWR 450km Range Ring Footprints & Translucent Surveillance Disks (Plan 6.2)
  if (!map.getSource('radar-coverage-disks-source')) {
    map.addSource('radar-coverage-disks-source', {
      type: 'geojson',
      data: RADAR_COVERAGE_DISKS_GEOJSON
    });
  }
  if (!map.getLayer('radar-coverage-disks-fill')) {
    map.addLayer({
      id: 'radar-coverage-disks-fill',
      type: 'fill',
      source: 'radar-coverage-disks-source',
      layout: { visibility: (isRadar && showRadarRings) ? 'visible' : 'none' },
      paint: {
        'fill-color': 'rgba(56, 189, 248, 0.05)',
        'fill-opacity': (isRadar && showRadarRings) ? 1.0 : 0.0
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('radar-coverage-disks-fill', 'visibility', (isRadar && showRadarRings) ? 'visible' : 'none');
    try {
      map.setPaintProperty('radar-coverage-disks-fill', 'fill-opacity', (isRadar && showRadarRings) ? 1.0 : 0.0);
    } catch (e) { }
  }

  if (!map.getSource('radar-range-rings-source')) {
    map.addSource('radar-range-rings-source', {
      type: 'geojson',
      data: RADAR_RANGE_RINGS_GEOJSON
    });
  }
  if (!map.getLayer('radar-range-rings-stroke')) {
    map.addLayer({
      id: 'radar-range-rings-stroke',
      type: 'line',
      source: 'radar-range-rings-source',
      layout: { visibility: (isRadar && showRadarRings) ? 'visible' : 'none' },
      paint: {
        'line-color': ['case', ['get', 'isOuter'], 'rgba(56, 189, 248, 0.40)', 'rgba(186, 230, 253, 0.22)'],
        'line-width': ['case', ['get', 'isOuter'], 1.1, 0.75],
        'line-dasharray': [3, 4],
        'line-opacity': (isRadar && showRadarRings) ? 0.90 : 0.0
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('radar-range-rings-stroke', 'visibility', (isRadar && showRadarRings) ? 'visible' : 'none');
    try {
      map.setPaintProperty('radar-range-rings-stroke', 'line-opacity', (isRadar && showRadarRings) ? 0.90 : 0.0);
    } catch (e) { }
  }

  // C. Continuous Synoptic & Convective Doppler Reflectivity Echo Field (Plan 6.2)
  const activeEchoesGeoJSON = generateActiveRadarReflectivityGeoJSON({
    cyclones: Array.isArray(dynamicCyclones) && dynamicCyclones.length > 0 ? dynamicCyclones : getActiveCyclones(),
    cloudburstEvent,
    stations,
    scheme: radarScheme
  });

  if (!map.getSource('active-radar-echoes-source')) {
    map.addSource('active-radar-echoes-source', {
      type: 'geojson',
      data: activeEchoesGeoJSON
    });
  } else {
    try {
      map.getSource('active-radar-echoes-source').setData(activeEchoesGeoJSON);
    } catch (e) { }
  }

  if (!map.getLayer('active-radar-echoes-fill')) {
    map.addLayer({
      id: 'active-radar-echoes-fill',
      type: 'fill',
      source: 'active-radar-echoes-source',
      layout: { visibility: isRadar ? 'visible' : 'none' },
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': isRadar ? ['*', ['get', 'opacity'], isRadarBoosted ? 0.95 : 0.70] : 0.0
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('active-radar-echoes-fill', 'visibility', isRadar ? 'visible' : 'none');
    try {
      map.setPaintProperty('active-radar-echoes-fill', 'fill-opacity', isRadar ? ['*', ['get', 'opacity'], isRadarBoosted ? 0.95 : 0.70] : 0.0);
    } catch (e) { }
  }

  if (!map.getLayer('active-radar-echoes-glow')) {
    map.addLayer({
      id: 'active-radar-echoes-glow',
      type: 'line',
      source: 'active-radar-echoes-source',
      layout: { visibility: isRadar ? 'visible' : 'none' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.2,
        'line-blur': 2.0,
        'line-opacity': isRadar ? (isRadarBoosted ? 0.85 : 0.55) : 0.0
      }
    }, beforeId);
  } else {
    map.setLayoutProperty('active-radar-echoes-glow', 'visibility', isRadar ? 'visible' : 'none');
    try {
      map.setPaintProperty('active-radar-echoes-glow', 'line-opacity', isRadar ? (isRadarBoosted ? 0.85 : 0.55) : 0.0);
    } catch (e) { }
  }

  // D. Live RainViewer Doppler Radar Tiles (Dual-Layer Volumetric Diffusion: Aura Underlay + Crystalline Core)
  if (radarTimestampPath) {
    const dopplerTileUrl = getRainViewerTileUrl(radarTimestampPath, radarScheme, 512);

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
      } catch (e) { }
    }

    // 1. Underlay Layer (doppler-radar-aura): Volumetric ambient bloom & chromatic luminescence
    const auraOpacity = isRadar ? (isRadarBoosted ? 0.72 : 0.50) : 0.0;
    const auraContrast = isRadarBoosted ? 0.22 : 0.12;
    const auraSat = isRadarBoosted ? 0.55 : 0.30;

    if (!map.getLayer('doppler-radar-aura')) {
      map.addLayer({
        id: 'doppler-radar-aura',
        type: 'raster',
        source: 'doppler-radar-source',
        layout: { visibility: isRadar ? 'visible' : 'none' },
        paint: {
          'raster-opacity': auraOpacity,
          'raster-resampling': 'linear',
          'raster-contrast': auraContrast,
          'raster-saturation': auraSat,
          'raster-fade-duration': 350
        }
      }, beforeId);
    } else {
      map.setLayoutProperty('doppler-radar-aura', 'visibility', isRadar ? 'visible' : 'none');
      try {
        map.setPaintProperty('doppler-radar-aura', 'raster-opacity', auraOpacity);
        map.setPaintProperty('doppler-radar-aura', 'raster-contrast', auraContrast);
        map.setPaintProperty('doppler-radar-aura', 'raster-saturation', auraSat);
        map.setPaintProperty('doppler-radar-aura', 'raster-fade-duration', 350);
      } catch (e) { }
    }

    // 2. Core Layer (doppler-radar-layer): High-definition reflectivity raster
    const coreOpacity = isRadar ? (isRadarBoosted ? 0.98 : 0.88) : 0.0;
    const coreContrast = isRadarBoosted ? 0.35 : 0.18;
    const coreSat = isRadarBoosted ? 0.60 : 0.35;

    if (!map.getLayer('doppler-radar-layer')) {
      map.addLayer({
        id: 'doppler-radar-layer',
        type: 'raster',
        source: 'doppler-radar-source',
        layout: { visibility: isRadar ? 'visible' : 'none' },
        paint: {
          'raster-opacity': coreOpacity,
          'raster-resampling': 'linear',
          'raster-fade-duration': 350,
          'raster-contrast': coreContrast,
          'raster-saturation': coreSat
        }
      }, beforeId);
    } else {
      map.setLayoutProperty('doppler-radar-layer', 'visibility', isRadar ? 'visible' : 'none');
      try {
        map.setPaintProperty('doppler-radar-layer', 'raster-opacity', coreOpacity);
        map.setPaintProperty('doppler-radar-layer', 'raster-fade-duration', 350);
        map.setPaintProperty('doppler-radar-layer', 'raster-contrast', coreContrast);
        map.setPaintProperty('doppler-radar-layer', 'raster-saturation', coreSat);
      } catch (e) { }
    }
  } else {
    if (map.getLayer('doppler-radar-aura')) {
      map.setLayoutProperty('doppler-radar-aura', 'visibility', 'none');
    }
    if (map.getLayer('doppler-radar-layer')) {
      map.setLayoutProperty('doppler-radar-layer', 'visibility', 'none');
    }
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

  // 6.45 AetherAura™ Live Air Quality (AQI) Station Nodes & Labels (Continuous raster handled via thermo-aqi://)
  const isAqi = activeLayer === 'aqi';

  // Clean up legacy circular polygon bubble layers
  ['aqi-dispersion-outer', 'aqi-dispersion-core'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });

  if (aqiGeoJSON) {
    if (!map.getSource('aqi-atmospheric-source')) {
      map.addSource('aqi-atmospheric-source', {
        type: 'geojson',
        data: aqiGeoJSON
      });
    } else {
      try {
        map.getSource('aqi-atmospheric-source').setData(aqiGeoJSON);
      } catch (e) { }
    }

    // A. Station Gemstone Beacons (Zoom >= 4.5)
    if (!map.getLayer('aqi-station-nodes')) {
      map.addLayer({
        id: 'aqi-station-nodes',
        type: 'circle',
        source: 'aqi-atmospheric-source',
        filter: ['!has', 'type'],
        minzoom: 4.5,
        layout: { visibility: isAqi ? 'visible' : 'none' },
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            4.5, 4.0,
            8.0, 8.0,
            12.0, 14.0
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-opacity': isAqi ? 0.95 : 0.0,
          'circle-stroke-opacity': isAqi ? 0.90 : 0.0
        }
      }, beforeId);
    } else {
      map.setLayoutProperty('aqi-station-nodes', 'visibility', isAqi ? 'visible' : 'none');
      try {
        map.setPaintProperty('aqi-station-nodes', 'circle-opacity', isAqi ? 0.95 : 0.0);
        map.setPaintProperty('aqi-station-nodes', 'circle-stroke-opacity', isAqi ? 0.90 : 0.0);
      } catch (e) { }
    }

    // B. Station Numeric AQI Labels (Zoom >= 6.5)
    if (!map.getLayer('aqi-station-labels')) {
      map.addLayer({
        id: 'aqi-station-labels',
        type: 'symbol',
        source: 'aqi-atmospheric-source',
        filter: ['!has', 'type'],
        minzoom: 6.5,
        layout: {
          visibility: isAqi ? 'visible' : 'none',
          'text-field': ['to-string', ['get', 'aqi']],
          'text-font': ['Noto Sans Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            6.5, 9.0,
            9.0, 11.0,
            12.0, 13.0
          ],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(15, 23, 42, 0.95)',
          'text-halo-width': 1.6
        }
      });
    } else {
      map.setLayoutProperty('aqi-station-labels', 'visibility', isAqi ? 'visible' : 'none');
    }
  } else {
    ['aqi-station-nodes', 'aqi-station-labels'].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'none');
      }
    });
  }

  // Clean up legacy antimeridian seam layers if previously attached
  if (map.getLayer('antimeridian-seam-layer')) {
    map.removeLayer('antimeridian-seam-layer');
  }
  if (map.getSource('antimeridian-seam-source')) {
    map.removeSource('antimeridian-seam-source');
  }

  // 6.5 Progressive Multi-Tier Windy Vector Hierarchy
  const isOverlayVisible = isSatellite || activeLayer === 'temp' || activeLayer === 'precip' || activeLayer === 'aqi' || isHeatmapVisible;
  const isDarkOrWeather = isOverlayVisible || activeLayer === 'wind';
  // Universal national border & coastline outline across all layers and maps
  const isUniversalOutlineVisible = !isSatellite;

  // A. Razor-Sharp Dual-Stroke Vector National Borders & Coastlines (Visible across ALL layers & zooms)
  if (!map.getSource('world-countries-source')) {
    map.addSource('world-countries-source', {
      type: 'geojson',
      data: WORLD_COUNTRIES_DATA
    });
  }

  if (!map.getLayer('windy-country-borders-casing')) {
    map.addLayer({
      id: 'windy-country-borders-casing',
      type: 'line',
      source: 'world-countries-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible'
      },
      paint: {
        'line-color': '#f8fafc',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          1, 1.8,
          2, 2.1,
          5, 2.6,
          8, 3.3
        ],
        'line-opacity': isDarkOrWeather ? 0.32 : 0.0
      }
    });
  } else {
    map.setLayoutProperty('windy-country-borders-casing', 'visibility', 'visible');
    map.setPaintProperty('windy-country-borders-casing', 'line-color', '#f8fafc');
    map.setPaintProperty('windy-country-borders-casing', 'line-opacity', isDarkOrWeather ? 0.32 : 0.0);
  }

  if (!map.getLayer('windy-country-borders')) {
    map.addLayer({
      id: 'windy-country-borders',
      type: 'line',
      source: 'world-countries-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible'
      },
      paint: {
        'line-color': '#05080f',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          1, 0.85,
          2, 1.05,
          5, 1.45,
          8, 2.05
        ],
        'line-opacity': 0.90
      }
    });
  } else {
    map.setLayoutProperty('windy-country-borders', 'visibility', 'visible');
    map.setPaintProperty('windy-country-borders', 'line-color', '#05080f');
    map.setPaintProperty('windy-country-borders', 'line-opacity', 0.90);
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
        visibility: isUniversalOutlineVisible ? 'visible' : 'none'
      },
      paint: {
        'raster-opacity': isUniversalOutlineVisible ? 1.0 : 0.0,
        'raster-fade-duration': 250
      }
    });
  } else {
    map.setLayoutProperty('overlay-labels-and-boundaries', 'visibility', isUniversalOutlineVisible ? 'visible' : 'none');
    try {
      map.setPaintProperty('overlay-labels-and-boundaries', 'raster-opacity', isUniversalOutlineVisible ? 1.0 : 0.0);
    } catch (e) { }
  }

  // Lock country boundary Z-order above all weather rasters/heatmaps and below place labels
  try {
    const labelAnchor = map.getLayer('windy-overview-labels') ? 'windy-overview-labels' : undefined;
    if (map.getLayer('windy-country-borders-casing')) {
      map.moveLayer('windy-country-borders-casing', labelAnchor);
    }
    if (map.getLayer('windy-country-borders')) {
      map.moveLayer('windy-country-borders', labelAnchor);
    }
  } catch (e) { }

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
  isRankingsOpen = false,
  isMeteoPanelOpen = false,
  showParticles = true,
  onToggleParticles,
  windParticleMode = 'normal',
  onWindParticleModeChange,
  showTemperature = true,
  tempUnit = 'C',
  onToggleTempUnit = null,
  windUnit: externalWindUnit,
  onWindUnitChange,
  humidity = 90,
  pressureDrop = 30,
  temperature = 18,
  windSpeed = 45,
  tcwv = 52,
  cloudburstEvent = null,
  isMlRetrying = false,
  onRefreshMlStatus = null,
  onFocusEpicenter = null,
  onHoverTemp = null
}) {
  const isMlLive = cloudburstEvent?.isLive === true;
  const hasRightDrawerOpen = !isHomeView && (isAnalyticsOpen || isRankingsOpen);
  const hasLeftDrawerOpen = !isHomeView && (isMeteoPanelOpen || activeLayer === 'precip');
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

  const [internalWindUnit, setInternalWindUnit] = useState('km/h');
  const windUnit = externalWindUnit || internalWindUnit;
  const setWindUnit = useCallback((val) => {
    setInternalWindUnit(val);
    onWindUnitChange?.(val);
  }, [onWindUnitChange]);

  const [showIsotachs, setShowIsotachs] = useState(true);

  const windUnitRef = useRef(windUnit);
  windUnitRef.current = windUnit;

  useEffect(() => {
    windUnitRef.current = windUnit;
  }, [windUnit]);

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
      if (windModeRef.current === 'off') {
        onWindParticleModeChange?.('silk');
      }
    } else if (layerKey === 'temp') {
      setIsTempLoading(false);
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
      } catch (e) { }
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
  const [mapBearing, setMapBearing] = useState(0);
  const [isNorthLocked, setIsNorthLocked] = useState(false);

  // RainViewer live Doppler radar state & playback
  const [radarFrames, setRadarFrames] = useState([]);
  const [radarStatus, setRadarStatus] = useState('loading');
  const [radarScheme, setRadarScheme] = useState('nordic');
  const [radarMistDensity, setRadarMistDensity] = useState(1.0); // 0.5 Whisper, 1.0 Balanced, 1.8 Torrent
  const [hoveredRadarStation, setHoveredRadarStation] = useState(null);
  const [radarFrameIndex, setRadarFrameIndex] = useState(-1);
  const [isRadarPlaying, setIsRadarPlaying] = useState(false);
  const [radarPlaybackSpeed, setRadarPlaybackSpeed] = useState(1);
  const [isRadarBoosted, setIsRadarBoosted] = useState(true);
  const [showRadarRings, setShowRadarRings] = useState(true);
  const isRadarBoostedRef = useRef(isRadarBoosted);
  isRadarBoostedRef.current = isRadarBoosted;
  const showRadarRingsRef = useRef(showRadarRings);
  showRadarRingsRef.current = showRadarRings;

  // AetherAura™ Live Air Quality (AQI) State with 30-min Sliding Window Cache
  const [aqiDataMap, setAqiDataMap] = useState(() => {
    const cached = getCachedAQI();
    return cached?.data || null;
  });
  const [isAqiLoading, setIsAqiLoading] = useState(false);
  const [aqiMinutesRemaining, setAqiMinutesRemaining] = useState(() => getAqiCacheMinutesRemaining());
  const [selectedAqiStation, setSelectedAqiStation] = useState(null);
  const [aqiCategoryFilter, setAqiCategoryFilter] = useState(null);

  const aqiGeoJSON = useMemo(() => {
    if (!aqiDataMap) return null;
    return generateAqiAtmosphericGeoJSON(aqiDataMap);
  }, [aqiDataMap]);

  // Live AQI synchronization (30-min sliding window with strict cache eviction)
  useEffect(() => {
    let isMounted = true;
    const syncAqi = async (force = false) => {
      setIsAqiLoading(true);
      try {
        const data = await getLiveAirQualityNetwork(null, force);
        if (isMounted && data) {
          setAqiDataMap(data);
          setAqiMinutesRemaining(getAqiCacheMinutesRemaining());
        }
      } catch (err) {
        console.warn('[AQI] Sync failed:', err);
      } finally {
        if (isMounted) setIsAqiLoading(false);
      }
    };

    if (selectedWeatherLayer === 'aqi' && !aqiDataMap) {
      syncAqi(false);
    }

    const timer = setInterval(() => {
      const remaining = getAqiCacheMinutesRemaining();
      setAqiMinutesRemaining(remaining);
      if (remaining <= 0 && selectedWeatherLayer === 'aqi') {
        syncAqi(true);
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [selectedWeatherLayer, stations, aqiDataMap]);

  // Fetch the latest RainViewer radar frames and refresh every 10 minutes
  useEffect(() => {
    let isMounted = true;
    const fetchRadarTimestamp = async () => {
      try {
        const past = await getOrFetchRadarMetadata(async () => {
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
            return Array.isArray(data?.radar?.past) ? data.radar.past : [];
          } finally {
            clearTimeout(timeoutId);
          }
        });
        if (!isMounted) return;

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
      }
    };

    fetchRadarTimestamp();
    const pollInterval = setInterval(fetchRadarTimestamp, 10 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  const effectiveFrameIndex = radarFrames.length > 0
    ? (radarFrameIndex >= 0 && radarFrameIndex < radarFrames.length
      ? radarFrameIndex
      : radarFrames.length - 1)
    : 0;
  const currentRadarFrame = radarFrames.length > 0 ? radarFrames[effectiveFrameIndex] : null;
  const isLatestRadarFrame = radarFrames.length > 0 && effectiveFrameIndex === radarFrames.length - 1;
  const radarTimestampPath = currentRadarFrame?.path || null;
  const radarTimestampTime = currentRadarFrame?.time
    ? new Date(currentRadarFrame.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const minutesAgo = currentRadarFrame?.time
    ? Math.max(0, Math.round((Date.now() / 1000 - currentRadarFrame.time) / 60))
    : 0;

  // Radar playback timeline animation loop
  useEffect(() => {
    if (!isRadarPlaying || radarFrames.length <= 1 || selectedWeatherLayer !== 'precip') {
      return;
    }

    const frameDelayMs = Math.round(750 / radarPlaybackSpeed);
    const dwellOnLiveMs = 1400; // brief pause on live frame before restarting loop

    const isCurrentAtEnd = effectiveFrameIndex === radarFrames.length - 1;
    const timer = setTimeout(() => {
      setRadarFrameIndex((prev) => {
        const curr = prev === -1 ? radarFrames.length - 1 : prev;
        const next = curr + 1;
        if (next >= radarFrames.length) {
          return 0;
        }
        return next;
      });
    }, isCurrentAtEnd ? dwellOnLiveMs : frameDelayMs);

    return () => clearTimeout(timer);
  }, [isRadarPlaying, effectiveFrameIndex, radarFrames.length, radarPlaybackSpeed, selectedWeatherLayer]);

  const handleCycleRadarScheme = () => {
    const schemeOrder = RADAR_ART_PALETTES.map((p) => p.id);
    const nextIdx = (schemeOrder.indexOf(radarScheme) + 1) % schemeOrder.length;
    setRadarScheme(schemeOrder[nextIdx]);
  };

  const handleCycleRadarSpeed = () => {
    const speeds = [0.5, 1, 2];
    const nextIdx = (speeds.indexOf(radarPlaybackSpeed) + 1) % speeds.length;
    setRadarPlaybackSpeed(speeds[nextIdx]);
  };

  const handleCycleMistDensity = () => {
    const densities = [0.5, 1.0, 1.8];
    const nextIdx = (densities.indexOf(radarMistDensity) + 1) % densities.length;
    setRadarMistDensity(densities[nextIdx]);
  };

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

  // AeroSilk™ Streamline particle buffers optimized for 120 FPS high-refresh monitors (5,500 filaments)
  const MAX_PARTICLES = 5500;
  const particlesRef = useRef({
    x: new Float32Array(MAX_PARTICLES),
    y: new Float32Array(MAX_PARTICLES),
    prevX: new Float32Array(MAX_PARTICLES),
    prevY: new Float32Array(MAX_PARTICLES),
    age: new Int16Array(MAX_PARTICLES),
    maxAge: new Int16Array(MAX_PARTICLES),
    speed: new Float32Array(MAX_PARTICLES)
  });

  // Dedicated Liquid Silk™ falling rain particle buffer for Rain Radar
  const MAX_RAIN_PARTICLES = 850;
  const rainParticlesRef = useRef({
    x: new Float32Array(MAX_RAIN_PARTICLES),
    y: new Float32Array(MAX_RAIN_PARTICLES),
    speed: new Float32Array(MAX_RAIN_PARTICLES),
    mass: new Float32Array(MAX_RAIN_PARTICLES),
    swayOffset: new Float32Array(MAX_RAIN_PARTICLES)
  });

  // Swirling Aerosol Mist Buffer (Plan 5.2)
  const MAX_MIST_PARTICLES = 160;
  const mistParticlesRef = useRef({
    x: new Float32Array(MAX_MIST_PARTICLES),
    y: new Float32Array(MAX_MIST_PARTICLES),
    radius: new Float32Array(MAX_MIST_PARTICLES),
    alpha: new Float32Array(MAX_MIST_PARTICLES),
    vx: new Float32Array(MAX_MIST_PARTICLES),
    vy: new Float32Array(MAX_MIST_PARTICLES),
    life: new Float32Array(MAX_MIST_PARTICLES),
    maxLife: new Float32Array(MAX_MIST_PARTICLES)
  });

  // Concentric Ground Impact Splash Ripples Buffer (Ring buffer)
  const MAX_RIPPLES = 80;
  const ripplesRef = useRef({
    x: new Float32Array(MAX_RIPPLES),
    y: new Float32Array(MAX_RIPPLES),
    radius: new Float32Array(MAX_RIPPLES),
    maxRadius: new Float32Array(MAX_RIPPLES),
    alpha: new Float32Array(MAX_RIPPLES),
    active: new Uint8Array(MAX_RIPPLES),
    head: 0
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
    } catch (err) { }
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
      const outerDot = document.createElement('div');
      outerDot.className = 'w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-lg flex items-center justify-center';
      const innerDot = document.createElement('div');
      innerDot.className = 'w-1.5 h-1.5 rounded-full bg-white';
      outerDot.appendChild(innerDot);
      userEl.appendChild(outerDot);

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
      attributionControl: false,
      preserveDrawingBuffer: false,
      fadeDuration: 0
    });

    mapRef.current = map;
    window.map = map;
    map.on('rotate', () => setMapBearing(map.getBearing()));

    const handleMapError = (event) => {
      if (event.sourceId === 'basemap') {
        setTileError({
          scope: 'base',
          message: 'Street map tiles could not be loaded. Check your connection and try again.'
        });
        return;
      }

      if ((event.sourceId === 'esri-satellite' || event.sourceId === 'satellite-source') && mapViewRef.current === 'satellite') {
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

      applyMapLayersAndHeatmap(
        map,
        isSat,
        selectedWeatherLayer,
        isHeatmapVis,
        heatmapGeoJSON,
        radarTimestampPath,
        cloudburstEvent,
        radarScheme,
        isRadarBoostedRef.current,
        showRadarRingsRef.current,
        getActiveCyclones(),
        stations,
        aqiGeoJSON,
        showIsotachs
      );
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

      setIsTempLoading(false);
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
      const wrapper = document.createElement('div');
      wrapper.className = 'relative flex items-center justify-center';

      const shockwave = document.createElement('span');
      shockwave.className = 'absolute w-14 h-14 rounded-full border border-white/95 animate-lightning-shockwave';

      const ping = document.createElement('span');
      ping.className = 'absolute w-8 h-8 rounded-full bg-cyan-300/40 blur-xs animate-ping';

      const badge = document.createElement('div');
      badge.className = 'relative w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-[0_0_18px_#ffffff,0_0_30px_#38bdf8] animate-lightning-flash';

      const svgNS = 'http://www.w3.org/2000/svg';
      const boltSvg = document.createElementNS(svgNS, 'svg');
      boltSvg.setAttribute('class', 'w-3.5 h-3.5 text-cyan-500 fill-cyan-400');
      boltSvg.setAttribute('viewBox', '0 0 24 24');
      boltSvg.setAttribute('fill', 'currentColor');

      const boltPoly = document.createElementNS(svgNS, 'polygon');
      boltPoly.setAttribute('points', '13 2 3 14 12 14 11 22 21 10 12 10 13 2');
      boltSvg.appendChild(boltPoly);

      badge.appendChild(boltSvg);
      wrapper.appendChild(shockwave);
      wrapper.appendChild(ping);
      wrapper.appendChild(badge);
      el.appendChild(wrapper);

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([strike.lon, strike.lat])
        .addTo(activeMap);

      // Clean up after flash animation finishes
      setTimeout(() => {
        try {
          marker.remove();
        } catch (e) { }
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

    applyMapLayersAndHeatmap(
      map,
      isSat,
      selectedWeatherLayer,
      isHeatmapVis,
      heatmapGeoJSON,
      radarTimestampPath,
      cloudburstEvent,
      radarScheme,
      isRadarBoosted,
      showRadarRings,
      getActiveCyclones(),
      stations,
      aqiGeoJSON,
      showIsotachs
    );
  }, [
    heatmapGeoJSON,
    showTemperature,
    mapView,
    selectedWeatherLayer,
    radarTimestampPath,
    cloudburstEvent,
    radarScheme,
    isRadarBoosted,
    showRadarRings,
    stations,
    aqiGeoJSON,
    showIsotachs
  ]);

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
      } catch (e) { }
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

        const isGrand = windParticleMode === 'grand';
        for (let i = 0; i < count; i++) {
          const rx = Math.random() * canvas.width;
          const ry = Math.random() * canvas.height;
          p.x[i] = rx;
          p.y[i] = ry;
          p.prevX[i] = rx;
          p.prevY[i] = ry;
          const maxAge = isGrand ? (160 + Math.floor(Math.random() * 120)) : (70 + Math.floor(Math.random() * 80));
          p.age[i] = Math.floor(Math.random() * maxAge);
          p.maxAge[i] = maxAge;
          p.speed[i] = 0.85 + Math.random() * 0.30;
        }

        const rainP = rainParticlesRef.current;
        for (let i = 0; i < MAX_RAIN_PARTICLES; i++) {
          rainP.x[i] = Math.random() * canvas.width;
          rainP.y[i] = Math.random() * canvas.height;
          rainP.speed[i] = 0.85 + Math.random() * 0.35;
          rainP.mass[i] = 0.8 + Math.random() * 0.4;
          rainP.swayOffset[i] = Math.random() * Math.PI * 2;
        }

        const mistP = mistParticlesRef.current;
        for (let i = 0; i < MAX_MIST_PARTICLES; i++) {
          mistP.x[i] = Math.random() * canvas.width;
          mistP.y[i] = Math.random() * canvas.height;
          mistP.radius[i] = 16 + Math.random() * 20;
          mistP.alpha[i] = 0.05 + Math.random() * 0.06;
          mistP.vx[i] = (Math.random() - 0.48) * 0.45;
          mistP.vy[i] = 0.2 + Math.random() * 0.5;
          mistP.life[i] = Math.floor(Math.random() * 150);
          mistP.maxLife[i] = 130 + Math.random() * 160;
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
      const isVisualWeatherLayer = selectedWeatherLayer === 'wind' || selectedWeatherLayer === 'temp' || selectedWeatherLayer === 'precip' || selectedWeatherLayer === 'aqi';
      if (!isRunning || ((!showParticles || mode === 'off') && !isVisualWeatherLayer)) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Dedicated Liquid Silk™ Rain Engine & Celestial Astrolabe Radar Station Loop (Plan 5.2 & 5.3)
      if (selectedWeatherLayer === 'precip') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';

        const rainP = rainParticlesRef.current;
        const width = canvas.width;
        const height = canvas.height;
        const now = Date.now();

        // 1. Swirling Aerosol Mist Fog Layer (Plan 5.2 & 6.3: High-visibility volumetric mist)
        if (radarMistDensity > 0.05) {
          const mistP = mistParticlesRef.current;
          const activeMistCount = Math.min(MAX_MIST_PARTICLES, Math.floor(MAX_MIST_PARTICLES * Math.min(1.5, radarMistDensity)));
          for (let i = 0; i < activeMistCount; i++) {
            mistP.life[i]++;
            if (mistP.life[i] >= mistP.maxLife[i]) {
              mistP.x[i] = Math.random() * width;
              mistP.y[i] = Math.random() * height;
              const mPos = screenToLngLat(mistP.x[i], mistP.y[i]);
              const mRain = getLocalPrecipitation(mPos.lng, mPos.lat);
              if (mRain < 0.05 && Math.random() > 0.35) {
                continue;
              }
              mistP.radius[i] = 18 + Math.random() * 24;
              mistP.alpha[i] = (0.08 + Math.random() * 0.10) * radarMistDensity;
              mistP.vx[i] = (Math.random() - 0.48) * 0.55;
              mistP.vy[i] = 0.25 + Math.random() * 0.6;
              mistP.life[i] = 0;
              mistP.maxLife[i] = 130 + Math.random() * 160;
            }

            mistP.x[i] += mistP.vx[i];
            mistP.y[i] += mistP.vy[i];

            const halfLife = mistP.maxLife[i] * 0.5;
            const currentAlpha = mistP.alpha[i] * (1 - Math.abs(mistP.life[i] - halfLife) / halfLife);

            if (currentAlpha > 0.005) {
              const mGrad = ctx.createRadialGradient(
                mistP.x[i], mistP.y[i], 0,
                mistP.x[i], mistP.y[i], mistP.radius[i]
              );
              mGrad.addColorStop(0, `rgba(235, 248, 255, ${currentAlpha * 1.35})`);
              mGrad.addColorStop(0.45, `rgba(186, 230, 253, ${currentAlpha * 0.70})`);
              mGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');

              ctx.beginPath();
              ctx.arc(mistP.x[i], mistP.y[i], mistP.radius[i], 0, Math.PI * 2);
              ctx.fillStyle = mGrad;
              ctx.fill();
            }
          }
        }

        // 2. Concentric Ground Impact Splash Ripples (Plan 5.2 & 6.3)
        const rip = ripplesRef.current;
        for (let i = 0; i < MAX_RIPPLES; i++) {
          if (rip.active[i]) {
            rip.radius[i] += 0.58;
            rip.alpha[i] *= 0.92;
            if (rip.radius[i] >= rip.maxRadius[i] || rip.alpha[i] < 0.015) {
              rip.active[i] = 0;
            } else {
              ctx.beginPath();
              ctx.arc(rip.x[i], rip.y[i], rip.radius[i], 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(186, 230, 253, ${rip.alpha[i] * 1.3})`;
              ctx.lineWidth = 1.15;
              ctx.stroke();
            }
          }
        }

        // 3. Render Liquid Silk™ Tapered Luminous Droplets (Plan 5.2 & 6.3)
        ctx.lineCap = 'round';

        for (let i = 0; i < MAX_RAIN_PARTICLES; i++) {
          const rx = rainP.x[i];
          const ry = rainP.y[i];

          // Sample local geographic coordinate
          const pos = screenToLngLat(rx, ry);
          const localPrecip = getLocalPrecipitation(pos.lng, pos.lat);
          const hasRain = localPrecip > 0.05;

          // Sample local wind drift
          const cosLat = Math.max(0.18, Math.cos((pos.lat * Math.PI) / 180));
          const wind = getWindVector(pos.lng, pos.lat);
          const uNorm = wind.u / cosLat;

          // Sinusoidal wind sway & aerodynamic mass turbulence
          const sway = Math.sin(now * 0.0035 + (rainP.swayOffset ? rainP.swayOffset[i] : i)) * 0.45;
          const vy = 8.5 + rainP.speed[i] * (hasRain ? 6.0 : 2.5);
          const vx = (uNorm * 0.42) + sway;

          const streakLen = (hasRain ? 20.0 : 8.0) + rainP.speed[i] * (hasRain ? 14.0 : 5.0);
          const norm = Math.hypot(vx, vy);
          const dirX = vx / norm;
          const dirY = vy / norm;

          const tailX = rx - dirX * streakLen;
          const tailY = ry - dirY * streakLen;

          if (hasRain) {
            // Tapered luminous gradient from dissolving tail to illuminated head
            const headAlpha = Math.min(0.95, 0.45 + localPrecip * 0.04);
            const tailAlpha = 0.05;

            const strokeGrad = ctx.createLinearGradient(tailX, tailY, rx, ry);
            strokeGrad.addColorStop(0, `rgba(186, 230, 253, ${tailAlpha})`);
            strokeGrad.addColorStop(0.60, `rgba(186, 230, 253, ${headAlpha * 0.65})`);
            strokeGrad.addColorStop(1, `rgba(240, 249, 255, ${headAlpha})`);

            ctx.beginPath();
            ctx.lineWidth = localPrecip > 20 ? 2.2 : 1.45;
            ctx.strokeStyle = strokeGrad;
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(rx, ry);
            ctx.stroke();

            // Luminous head bead in brilliant white
            ctx.beginPath();
            ctx.arc(rx, ry, localPrecip > 20 ? 1.8 : 1.35, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${headAlpha})`;
            ctx.fill();

            // Spawn ground splash ripples when hitting bottom region
            if (ry > height * 0.45 && Math.random() < 0.12) {
              const ripIdx = rip.head;
              rip.x[ripIdx] = rx;
              rip.y[ripIdx] = ry;
              rip.radius[ripIdx] = 1.5;
              rip.maxRadius[ripIdx] = 10.0 + Math.random() * 12.0;
              rip.alpha[ripIdx] = Math.min(0.70, 0.30 + localPrecip * 0.03);
              rip.active[ripIdx] = 1;
              rip.head = (ripIdx + 1) % MAX_RIPPLES;
            }
          } else {
            // Perceptible ambient celestial drift in clear sectors
            ctx.beginPath();
            ctx.lineWidth = 0.75;
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.20)';
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(rx, ry);
            ctx.stroke();
          }

          // Advance particle
          rainP.x[i] += vx;
          rainP.y[i] += vy;

          // Wrap around top or screen edges
          if (rainP.y[i] > height + 35 || rainP.x[i] < -35 || rainP.x[i] > width + 35) {
            rainP.x[i] = Math.random() * width;
            rainP.y[i] = -15 - Math.random() * 40;
            rainP.speed[i] = 0.85 + Math.random() * 0.35;
          }
        }

        // 4. Render Celestial Astrolabe Beacons for RADAR_COVERAGE_CENTERS (Plan 5.3)
        const sweepAngle = (now / 3200) * (Math.PI * 2);
        const pulsePhase = (now % 2200) / 2200;
        const pulseRadius = 3 + pulsePhase * 24;
        const pulseAlpha = Math.max(0, 1 - pulsePhase) * 0.40;

        // Dynamic scale based on zoom level: compact 14px to 22px radius
        const currentZoom = (typeof map.getZoom === 'function') ? map.getZoom() : 5;
        const sweepRadius = Math.max(15, Math.min(22, 14 + (currentZoom - 3) * 1.6));

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

          if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) return;

          // A. Breathing Sonar Pulse Ring
          ctx.beginPath();
          ctx.arc(sx, sy, Math.min(sweepRadius * 1.45, pulseRadius), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(186, 230, 253, ${pulseAlpha})`;
          ctx.lineWidth = 0.75;
          ctx.stroke();

          // B. Concentric Astrolabe Hairline Rings
          // Outer ring (pale cyan)
          ctx.beginPath();
          ctx.arc(sx, sy, sweepRadius, 0, Math.PI * 2);
          ctx.lineWidth = 0.85;
          ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
          ctx.stroke();

          // Middle ring (pale gold)
          ctx.beginPath();
          ctx.arc(sx, sy, sweepRadius * 0.65, 0, Math.PI * 2);
          ctx.lineWidth = 0.65;
          ctx.strokeStyle = 'rgba(253, 230, 138, 0.35)';
          ctx.stroke();

          // Inner ring
          ctx.beginPath();
          ctx.arc(sx, sy, sweepRadius * 0.35, 0, Math.PI * 2);
          ctx.lineWidth = 0.55;
          ctx.strokeStyle = 'rgba(186, 230, 253, 0.25)';
          ctx.stroke();

          // C. 8-Point Nautical Compass Ticks
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(253, 230, 138, 0.60)';
          ctx.lineWidth = 0.75;
          for (let a = 0; a < 8; a++) {
            const ang = (a * Math.PI) / 4;
            const cosA = Math.cos(ang);
            const sinA = Math.sin(ang);
            const r1 = sweepRadius - (a % 2 === 0 ? 3.5 : 2.0);
            const r2 = sweepRadius + (a % 2 === 0 ? 3.5 : 2.0);
            ctx.moveTo(sx + cosA * r1, sy + sinA * r1);
            ctx.lineTo(sx + cosA * r2, sy + sinA * r2);
          }
          ctx.stroke();

          // D. Rotating Phosphor Sweep Fan (45-degree smooth gradient)
          const arcSpread = 0.75;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, sweepRadius, sweepAngle - arcSpread, sweepAngle, false);
          ctx.closePath();

          const grad = ctx.createRadialGradient(sx, sy, 1, sx, sy, sweepRadius);
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
          grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.18)');
          grad.addColorStop(1, 'rgba(56, 189, 248, 0.01)');
          ctx.fillStyle = grad;
          ctx.fill();

          // E. Crisp Leading Astrolabe Pointer
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(
            sx + Math.cos(sweepAngle) * sweepRadius,
            sy + Math.sin(sweepAngle) * sweepRadius
          );
          ctx.lineWidth = 1.1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.stroke();
          ctx.restore();

          // F. Pulsing Celestial Center Star
          const starPhase = Math.sin(now * 0.005 + station.lon) * 0.5 + 0.5;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.8 + starPhase * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(sx, sy, 3.5 + starPhase * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(253, 230, 138, 0.45)';
          ctx.fill();

          // G. Astrolabe Typography (Callsign + City)
          const cityName = station.name.replace(' (DWR)', '');
          ctx.font = '600 8.5px var(--font-mono, monospace)';
          ctx.fillStyle = 'rgba(224, 242, 254, 0.82)';
          ctx.textAlign = 'center';
          ctx.fillText(cityName, sx, sy + sweepRadius + 10);
        });

        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // AeroSilk™ Atmospheric Fluid Particle Engine (Real NWP Vectors & Sub-Pixel Geometry)
      const isDarkBg = mapViewRef.current === 'satellite' || selectedWeatherLayerRef.current === 'temp';
      const styleConfig = getWindParticleStyle(mode);

      let activeCount = Math.min(count, styleConfig.activeCount || 5500);
      let speedMult = styleConfig.speedMult || 0.17;
      let fadeRate = styleConfig.fadeRate || 0.08;
      let blendMode = styleConfig.blendMode || 'source-over';
      const styleColors = styleConfig.getColors ? styleConfig.getColors(isDarkBg) : null;

      let widthCalm = styleConfig.lineWidths?.mist || 0.65;
      let widthFine = styleConfig.lineWidths?.fine || 0.80;
      let widthMid = styleConfig.lineWidths?.mid || 1.05;
      let widthStrong = styleConfig.lineWidths?.strong || 1.35;

      let strokeCalm = styleColors?.mist || 'rgba(215, 240, 255, 0.35)';
      let strokeFine = styleColors?.fine || 'rgba(235, 248, 255, 0.65)';
      let strokeMid = styleColors?.mid || 'rgba(248, 252, 255, 0.88)';
      let strokeStrong = styleColors?.strong || 'rgba(255, 255, 255, 1.0)';

      // Active Wind Speed layer & main Silk layer: Windy-style airy density scaled by viewport area
      const isWindLayer = selectedWeatherLayer === 'wind';
      const isTempLayer = selectedWeatherLayer === 'temp';
      const isAqiLayer = selectedWeatherLayer === 'aqi';
      const isMainSilk = styleConfig.geometry === 'silk';
      const windyCount = Math.min(2000, Math.max(850, Math.floor((canvas.width * canvas.height) / 950)));

      if (isWindLayer) {
        activeCount = Math.min(count, windyCount);
        speedMult = 0.15;
        fadeRate = 0.16;
        blendMode = 'source-over';
      } else if (isTempLayer) {
        activeCount = Math.min(count, 5200);
        fadeRate = 0.08;
        blendMode = 'source-over';
      } else if (isAqiLayer) {
        activeCount = Math.min(count, 4800);
        speedMult = 0.16;
        fadeRate = 0.09;
        blendMode = 'source-over';
      } else if (isMainSilk) {
        activeCount = Math.min(count, windyCount);
      }

      // AeroSilk™ Exponential Ghost Trail Persistence
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeRate})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = blendMode;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const width = canvas.width;
      const height = canvas.height;

      const tierCalm = [];     // < 22 km/h (Ice-Cyan)
      const tierModerate = []; // 22-48 km/h (Emerald Green)
      const tierBrisk = [];    // 48-78 km/h (Solar Amber)
      const tierStorm = [];    // >= 78 km/h (Neon Magenta/Crimson)

      const tierThermalCryo = [];      // < 2°C (Glacial Frost - Luminous Ice Cyan)
      const tierThermalTemperate = []; // 2°C - 22°C (Living Biosphere - Ethereal Mint Dew Green)
      const tierThermalWarm = [];      // 22°C - 32°C (Subtropical Warmth - Golden Amber)
      const tierThermalHeat = [];      // >= 32°C (Thermal Dome - Solar Terracotta Coral)

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

        const k1 = getWindVector(pos0.lng, pos0.lat, 0, 'surface');
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

        const k2 = getWindVector(posMid.lng, posMid.lat, 0, 'surface');
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

        // Dynamic Vorticity Curvature Perturbation (Curling Van Gogh brushstrokes in vortexes & lee eddies)
        const curl = k2.vorticity || 0;
        const vortSens = styleConfig.vorticitySensitivity || (isWindLayer ? 5.5 : 2.5);
        const curlPerturb = Math.min(10.0, curl * vortSens);
        finalMidX += -stepY * curlPerturb;
        finalMidY += stepX * curlPerturb;

        const minStepDist = (isWindLayer || isMainSilk) ? 0.75 : 1.15;
        if (stepDist < minStepDist) {
          const scale = minStepDist / Math.max(0.001, stepDist);
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
            } else if (isTempLayer) {
              // Authentic Windy Streamlines: Ethereal silver-white ribbons layered by atmospheric velocity
              if (mag2 >= 3.6) {
                tierThermalHeat.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY); // Jetstream corridor
              } else if (mag2 >= 2.0) {
                tierThermalWarm.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY); // Moderate flow
              } else if (mag2 >= 1.0) {
                tierThermalTemperate.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY); // Gentle flow
              } else {
                tierThermalCryo.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY); // Ambient drift
              }
            } else if (isAqiLayer) {
              // AetherAura™ Atmospheric Particulate Haze Streamlines
              if (mag2 >= 2.8) {
                tierThermalHeat.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY);
              } else if (mag2 >= 1.6) {
                tierThermalWarm.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY);
              } else if (mag2 >= 0.8) {
                tierThermalTemperate.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY);
              } else {
                tierThermalCryo.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY);
              }
            } else if (styleConfig.geometry === 'thermal') {
              // Mode 4: Thermal Advection (Cold polar blast vs warm tropical air mass transport)
              const parcelTemp = computeGlobalThermodynamicTemp(posMid.lng, posMid.lat);
              if (parcelTemp >= 32.0) {
                tierThermalHeat.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY); // Tropical Heat Dome / Monsoon Surge
              } else if (parcelTemp >= 22.0) {
                tierThermalWarm.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY); // Subtropical Warm Advection
              } else if (parcelTemp >= 5.0) {
                tierThermalTemperate.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY); // Temperate Biosphere
              } else {
                tierThermalCryo.push(currX, currY, finalMidX, finalMidY, finalNextX, finalNextY); // Cryogenic Polar Blast
              }
            } else {
              let targetTier = null;
              // Vorticity Bloom: For Grand Ribbons mode, dynamic cyclonic vorticity
              // enhances velocity tiering so curling vortices and inflow corridors bloom with higher luminance
              const effectiveMag = (styleConfig.geometry === 'grand')
                ? (mag2 + (k2.vorticity || 0) * 2.2)
                : mag2;

              if (effectiveMag >= 4.2 && alpha > 0.30) {
                targetTier = tierStrong;
              } else if (effectiveMag >= 2.4 && alpha > 0.20) {
                targetTier = tierMid;
              } else if (effectiveMag >= 1.4 && alpha > 0.12) {
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
          p.maxAge[i] = (styleConfig.geometry === 'grand')
            ? (160 + Math.floor(Math.random() * 120))
            : (isWindLayer || isMainSilk)
              ? (45 + Math.floor(Math.random() * 45))
              : (70 + Math.floor(Math.random() * 80));
          p.speed[i] = 0.85 + Math.random() * 0.30;
        }
      }

      if (isWindLayer) {
        // --- Windy-Style Delicate White Streamlines over Oklab Velocity Heatmap ---
        const tiers = [
          { data: tierCalm, color: 'rgba(255, 255, 255, 0.30)', w: 0.45 },
          { data: tierModerate, color: 'rgba(255, 255, 255, 0.52)', w: 0.60 },
          { data: tierBrisk, color: 'rgba(255, 255, 255, 0.76)', w: 0.80 },
          { data: tierStorm, color: 'rgba(255, 255, 255, 0.94)', w: 1.00 }
        ];

        tiers.forEach(({ data, color, w }) => {
          if (data.length === 0) return;
          ctx.beginPath();
          ctx.lineWidth = w;
          ctx.strokeStyle = color;
          for (let j = 0; j < data.length; j += 6) {
            ctx.moveTo(data[j], data[j + 1]);
            ctx.quadraticCurveTo(data[j + 2], data[j + 3], data[j + 4], data[j + 5]);
          }
          ctx.stroke();
        });
      } else if (isTempLayer) {
        // Authentic Ventusky/Windy Silver-White Advection Ribbons (Zero chromatic clash with temperature field)
        // 1. Ambient Drift (< 1.0) - Soft translucent silver mist
        if (tierThermalCryo.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 0.70;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          for (let j = 0; j < tierThermalCryo.length; j += 6) {
            ctx.moveTo(tierThermalCryo[j], tierThermalCryo[j + 1]);
            ctx.quadraticCurveTo(tierThermalCryo[j + 2], tierThermalCryo[j + 3], tierThermalCryo[j + 4], tierThermalCryo[j + 5]);
          }
          ctx.stroke();
        }

        // 2. Gentle Flow (1.0 - 2.0) - Translucent silver filament
        if (tierThermalTemperate.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 0.85;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.44)';
          for (let j = 0; j < tierThermalTemperate.length; j += 6) {
            ctx.moveTo(tierThermalTemperate[j], tierThermalTemperate[j + 1]);
            ctx.quadraticCurveTo(tierThermalTemperate[j + 2], tierThermalTemperate[j + 3], tierThermalTemperate[j + 4], tierThermalTemperate[j + 5]);
          }
          ctx.stroke();
        }

        // 3. Moderate Corridors (2.0 - 3.6) - Crisp silver silk
        if (tierThermalWarm.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 1.05;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          for (let j = 0; j < tierThermalWarm.length; j += 6) {
            ctx.moveTo(tierThermalWarm[j], tierThermalWarm[j + 1]);
            ctx.quadraticCurveTo(tierThermalWarm[j + 2], tierThermalWarm[j + 3], tierThermalWarm[j + 4], tierThermalWarm[j + 5]);
          }
          ctx.stroke();
        }

        // 4. Jetstream & Gale Corridors (>= 3.6) - Luminous radiant silver
        if (tierThermalHeat.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 1.35;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          for (let j = 0; j < tierThermalHeat.length; j += 6) {
            ctx.moveTo(tierThermalHeat[j], tierThermalHeat[j + 1]);
            ctx.quadraticCurveTo(tierThermalHeat[j + 2], tierThermalHeat[j + 3], tierThermalHeat[j + 4], tierThermalHeat[j + 5]);
          }
          ctx.stroke();
        }
      } else if (isAqiLayer) {
        // AetherAura™ Micro-Aerosol Particulate Streamlines (Mint -> Amber -> Coral -> Crimson)
        if (tierThermalCryo.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 0.70;
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.40)'; // Good: Mint
          for (let j = 0; j < tierThermalCryo.length; j += 6) {
            ctx.moveTo(tierThermalCryo[j], tierThermalCryo[j + 1]);
            ctx.quadraticCurveTo(tierThermalCryo[j + 2], tierThermalCryo[j + 3], tierThermalCryo[j + 4], tierThermalCryo[j + 5]);
          }
          ctx.stroke();
        }
        if (tierThermalTemperate.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 0.90;
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)'; // Satisfactory: Amber
          for (let j = 0; j < tierThermalTemperate.length; j += 6) {
            ctx.moveTo(tierThermalTemperate[j], tierThermalTemperate[j + 1]);
            ctx.quadraticCurveTo(tierThermalTemperate[j + 2], tierThermalTemperate[j + 3], tierThermalTemperate[j + 4], tierThermalTemperate[j + 5]);
          }
          ctx.stroke();
        }
        if (tierThermalWarm.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 1.15;
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.75)'; // Moderate: Coral
          for (let j = 0; j < tierThermalWarm.length; j += 6) {
            ctx.moveTo(tierThermalWarm[j], tierThermalWarm[j + 1]);
            ctx.quadraticCurveTo(tierThermalWarm[j + 2], tierThermalWarm[j + 3], tierThermalWarm[j + 4], tierThermalWarm[j + 5]);
          }
          ctx.stroke();
        }
        if (tierThermalHeat.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 1.45;
          ctx.strokeStyle = 'rgba(225, 29, 72, 0.90)'; // Poor/Severe: Crimson
          for (let j = 0; j < tierThermalHeat.length; j += 6) {
            ctx.moveTo(tierThermalHeat[j], tierThermalHeat[j + 1]);
            ctx.quadraticCurveTo(tierThermalHeat[j + 2], tierThermalHeat[j + 3], tierThermalHeat[j + 4], tierThermalHeat[j + 5]);
          }
          ctx.stroke();
        }
      } else if (styleConfig.geometry === 'thermal') {
        // Mode 4: Thermal Advection (Cold polar blast vs warm tropical air mass transport)
        const cryoColor = styleColors?.cryo || 'rgba(56, 189, 248, 0.88)';
        const temperateColor = styleColors?.temperate || 'rgba(52, 211, 153, 0.90)';
        const warmColor = styleColors?.warm || 'rgba(251, 191, 36, 0.94)';
        const heatColor = styleColors?.heat || 'rgba(244, 63, 94, 1.0)';

        // 1. Polar Cold Advection (<5°C) - Glacial Ice Cyan
        if (tierThermalCryo.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 0.70;
          ctx.strokeStyle = cryoColor;
          for (let j = 0; j < tierThermalCryo.length; j += 6) {
            ctx.moveTo(tierThermalCryo[j], tierThermalCryo[j + 1]);
            ctx.quadraticCurveTo(tierThermalCryo[j + 2], tierThermalCryo[j + 3], tierThermalCryo[j + 4], tierThermalCryo[j + 5]);
          }
          ctx.stroke();
        }

        // 2. Temperate Biosphere (5-22°C) - Emerald Jade
        if (tierThermalTemperate.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 0.85;
          ctx.strokeStyle = temperateColor;
          for (let j = 0; j < tierThermalTemperate.length; j += 6) {
            ctx.moveTo(tierThermalTemperate[j], tierThermalTemperate[j + 1]);
            ctx.quadraticCurveTo(tierThermalTemperate[j + 2], tierThermalTemperate[j + 3], tierThermalTemperate[j + 4], tierThermalTemperate[j + 5]);
          }
          ctx.stroke();
        }

        // 3. Subtropical Warm Advection (22-32°C) - Golden Solar Amber
        if (tierThermalWarm.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 1.10;
          ctx.strokeStyle = warmColor;
          for (let j = 0; j < tierThermalWarm.length; j += 6) {
            ctx.moveTo(tierThermalWarm[j], tierThermalWarm[j + 1]);
            ctx.quadraticCurveTo(tierThermalWarm[j + 2], tierThermalWarm[j + 3], tierThermalWarm[j + 4], tierThermalWarm[j + 5]);
          }
          ctx.stroke();
        }

        // 4. Monsoon / Tropical Heat (>32°C) - Terracotta Coral
        if (tierThermalHeat.length > 0) {
          ctx.beginPath();
          ctx.lineWidth = 1.45;
          ctx.strokeStyle = heatColor;
          for (let j = 0; j < tierThermalHeat.length; j += 6) {
            ctx.moveTo(tierThermalHeat[j], tierThermalHeat[j + 1]);
            ctx.quadraticCurveTo(tierThermalHeat[j + 2], tierThermalHeat[j + 3], tierThermalHeat[j + 4], tierThermalHeat[j + 5]);
          }
          ctx.stroke();
        }
      } else {
        // AeroSilk™ Multi-Depth Silk Ribbons (Ventusky Pure Silk, Windy Dynamic Flow, Aero-Bioluminescence)
        ctx.setLineDash([]);

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

        // 2. Streamlines: Defined fluid flow corridors (soft pearl white / gold / violet)
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
        if (onHoverTemp) onHoverTemp(null);
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
        if (onHoverTemp && (activeLayer === 'temp' || selectedWeatherLayer === 'temp')) {
          const t = getCachedPointTemperature(lngLat.lat, lngLat.lng);
          onHoverTemp(t);
        }
        if (selectedWeatherLayer === 'precip') {
          let foundStation = null;
          for (let i = 0; i < RADAR_COVERAGE_CENTERS.length; i++) {
            const st = RADAR_COVERAGE_CENTERS[i];
            const p = map.project([st.lon, st.lat]);
            const dist = Math.hypot(x - p.x, y - p.y);
            if (dist < 26) {
              foundStation = { station: st, x: p.x, y: p.y };
              break;
            }
          }
          setHoveredRadarStation(foundStation);
        } else {
          setHoveredRadarStation(null);
        }
      } catch (err) { }
    });
  }, [onHoverTemp, activeLayer, selectedWeatherLayer]);

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
        if (onHoverTemp && (activeLayer === 'temp' || selectedWeatherLayer === 'temp')) {
          const t = getCachedPointTemperature(lngLat.lat, lngLat.lng);
          onHoverTemp(t);
        }
      } catch (err) { }
    }
  }, [onHoverTemp, activeLayer, selectedWeatherLayer]);

  const handleMouseLeave = useCallback(() => {
    setHoverCoords(null);
    setHoveredRadarStation(null);
    if (onHoverTemp) onHoverTemp(null);
  }, [onHoverTemp]);

  // Active Tropical Cyclone Systems
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    cycloneMarkersRef.current.forEach(m => m.remove());
    cycloneMarkersRef.current = [];

    // Fetch live cyclones on mount
    fetchLiveCyclones().catch(() => { });

    const updateCycloneMarkers = (cyclones) => {
      cycloneMarkersRef.current.forEach(m => m.remove());
      cycloneMarkersRef.current = [];

      (cyclones || []).forEach(cyclone => {
        const el = document.createElement('div');
        el.className = 'custom-cyclone-marker flex items-center gap-1.5 apple-liquid-glass px-2.5 py-1 rounded-full shadow-2xl cursor-pointer select-none transition-transform hover:scale-110 active:scale-95 border border-white/20 pointer-events-auto';
        el.title = `${cyclone.name} (${cyclone.status || cyclone.category}) — Wind: ${cyclone.windKmh} km/h, Pressure: ${cyclone.pressureHpa} hPa`;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'w-4 h-4 flex items-center justify-center animate-spin text-rose-400';
        iconSpan.style.animationDuration = '3.5s';

        const svgNS = 'http://www.w3.org/2000/svg';
        const cycloneSvg = document.createElementNS(svgNS, 'svg');
        cycloneSvg.setAttribute('viewBox', '0 0 24 24');
        cycloneSvg.setAttribute('fill', 'none');
        cycloneSvg.setAttribute('stroke', 'currentColor');
        cycloneSvg.setAttribute('stroke-width', '2.5');
        cycloneSvg.setAttribute('class', 'w-3.5 h-3.5 text-rose-400');

        const p1 = document.createElementNS(svgNS, 'path');
        p1.setAttribute('d', 'M12 2a10 10 0 0 1 7.07 17.07l-2.12-2.12A7 7 0 0 0 12 5v-3z');
        const p2 = document.createElementNS(svgNS, 'path');
        p2.setAttribute('d', 'M12 22a10 10 0 0 1-7.07-17.07l2.12 2.12A7 7 0 0 0 12 19v3z');
        cycloneSvg.appendChild(p1);
        cycloneSvg.appendChild(p2);
        iconSpan.appendChild(cycloneSvg);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-[11px] font-bold text-white tracking-wide';
        nameSpan.textContent = cyclone.name ?? '';

        const windSpan = document.createElement('span');
        windSpan.className = 'text-[9px] font-mono px-1 rounded bg-rose-500/30 text-rose-300 font-semibold';
        windSpan.textContent = `${cyclone.windKmh ?? ''}k`;

        el.appendChild(iconSpan);
        el.appendChild(nameSpan);
        el.appendChild(windSpan);

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
      } catch (err) { }
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

      // AQI station selection on click (Planetary Global Coverage)
      if (selectedWeatherLayerRef.current === 'aqi') {
        const entries = aqiDataMap ? Object.values(aqiDataMap) : [];
        let nearest = null;
        let minDist = Infinity;
        for (let i = 0; i < entries.length; i++) {
          const st = entries[i];
          const dist = Math.hypot(st.lat - lat, st.lon - lng);
          if (dist < minDist) {
            minDist = dist;
            nearest = st;
          }
        }
        if (nearest && minDist < 2.5) {
          setSelectedAqiStation(nearest);
        } else {
          const aqiVal = computeInterpolatedAqi(lng, lat);
          const cat = getAqiCategory(aqiVal);
          const pm25 = parseFloat((aqiVal * 0.44).toFixed(1));
          const pm10 = parseFloat((aqiVal * 0.75).toFixed(1));
          setSelectedAqiStation({
            stationId: `probe-${lng.toFixed(2)}-${lat.toFixed(2)}`,
            name: `${sectorName} (Probe Point)`,
            state: isIndia ? 'India' : 'Global Ocean / Sector',
            country: isIndia ? 'India' : 'Global',
            lat,
            lon: lng,
            aqi: aqiVal,
            category: cat.category,
            color: cat.color,
            pm2_5: pm25,
            pm10: pm10,
            no2: 14.5,
            o3: 38.0,
            dominantPollutant: pm25 > 50 ? 'PM2.5' : 'Ozone',
            healthAdvice: cat.healthAdvice,
            maskRecommended: cat.maskRecommended,
            time: new Date().toISOString(),
            isEstimated: true
          });
        }
      }

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
  const handleToggleNorthLock = () => {
    const map = mapRef.current;
    setIsNorthLocked((prev) => {
      const nextLocked = !prev;
      if (map) {
        if (nextLocked) {
          map.dragRotate?.disable();
          map.touchZoomRotate?.disableRotation();
          map.keyboard?.disableRotation?.();
          map.easeTo({
            bearing: 0,
            pitch: 0,
            duration: 600,
            easing: (t) => 1 - Math.pow(1 - t, 3),
          });
        } else {
          map.dragRotate?.enable();
          map.touchZoomRotate?.enableRotation();
          map.keyboard?.enableRotation?.();
        }
      }
      return nextLocked;
    });
  };
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
          opacity: ((showParticles && windParticleMode !== 'off') || selectedWeatherLayer === 'wind' || selectedWeatherLayer === 'temp' || selectedWeatherLayer === 'precip' || selectedWeatherLayer === 'aqi')
            ? 1
            : 0,
          pointerEvents: 'none'
        }}
      />

      {/* 2.2 Windy-Style Interactive Hover Weather Probe & Target Reticle */}
      {hoverCoords && (
        <div
          className="pointer-events-none absolute z-[25] -translate-x-1/2 -translate-y-full transition-transform duration-75 select-none"
          style={{
            left: `${hoverCoords.x}px`,
            top: `${hoverCoords.y}px`
          }}
        >
          {selectedWeatherLayer === 'wind' ? (() => {
            const vec = getWindVector(hoverCoords.lon, hoverCoords.lat, 0, 'surface');
            const speedKmh = Math.round(vec.mag * 13.5);
            const isKt = windUnit === 'kt';
            const displaySpeed = isKt ? Math.round(speedKmh * 0.539957) : speedKmh;
            const speedUnitLabel = isKt ? 'kt' : 'km/h';
            const compass = getWindDirectionCompass(vec.u, vec.v);
            const beaufort = getBeaufortScaleInfo(speedKmh);
            const gustKmh = estimateWindGust(speedKmh, false);
            const displayGust = isKt ? Math.round(gustKmh * 0.539957) : gustKmh;
            const color = getWindSpeedColor(speedKmh);

            return (
              <div className="flex flex-col items-center mb-1">
                <div
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/20 bg-slate-950/90 backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.5)] text-slate-200"
                  style={{ boxShadow: `0 4px 18px ${color}33` }}
                >
                  {/* Rotating Aerodynamic Wind Arrow */}
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 border border-white/20 shadow-sm shrink-0"
                    title={`Direction: ${compass.cardinal} (${compass.degrees}°)`}
                  >
                    <Navigation
                      className="w-3 h-3 transition-transform duration-75 text-cyan-300"
                      style={{
                        transform: `rotate(${compass.degrees}deg)`,
                        color: color
                      }}
                    />
                  </div>

                  {/* Wind Speed & Unit */}
                  <div className="flex items-center gap-1.5">
                    <span style={{ color }} className="text-sm font-bold tracking-tight">
                      {displaySpeed} {speedUnitLabel}
                    </span>
                  </div>

                  <div className="h-3.5 w-px bg-white/20" />

                  {/* Direction & Beaufort Badge */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-300">
                      {compass.cardinal} {compass.degrees}°
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-sans font-medium bg-white/10 whitespace-nowrap"
                      style={{ color }}
                    >
                      F{beaufort.force} · {beaufort.name}
                    </span>
                  </div>

                  <div className="h-3.5 w-px bg-white/20" />

                  {/* Estimated Gust */}
                  <span className="text-[10px] font-mono text-slate-400">
                    Gust: {displayGust}
                  </span>
                </div>

                {/* Pointer Arrow */}
                <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-slate-950/90" />

                {/* Target Crosshair Dot with Chromatic Velocity Aura */}
                <div
                  className="w-2.5 h-2.5 rounded-full border border-white/90 shadow-[0_0_8px_rgba(255,255,255,0.9)] -mb-1 pointer-events-none"
                  style={{ backgroundColor: color }}
                />
              </div>
            );
          })() : selectedWeatherLayer === 'aqi' ? (() => {
            const aqiVal = computeInterpolatedAqi(hoverCoords.lon, hoverCoords.lat);
            const cat = getAqiCategory(aqiVal);
            return (
              <div className="flex flex-col items-center mb-1">
                <div
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/20 bg-slate-950/90 backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.5)] text-slate-200"
                  style={{ boxShadow: `0 4px 20px ${cat.glowColor}` }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full ring-2 ring-white/30 animate-pulse" style={{ backgroundColor: cat.color }} />
                    <span style={{ color: cat.color }} className="text-sm font-bold tracking-tight">AQI {aqiVal}</span>
                  </div>
                  <div className="h-3.5 w-px bg-white/20" />
                  <span className="text-[11px] font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                  <div className="h-3.5 w-px bg-white/20" />
                  <span className="text-[10px] font-mono text-slate-400">
                    {Math.abs(hoverCoords.lat).toFixed(1)}°{hoverCoords.lat >= 0 ? 'N' : 'S'}, {Math.abs(hoverCoords.lon).toFixed(1)}°{hoverCoords.lon >= 0 ? 'E' : 'W'}
                  </span>
                </div>
                {/* Pointer Arrow */}
                <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-slate-950/90" />
                {/* Target Crosshair Dot with Chromatic Glow */}
                <div
                  className="w-2 h-2 rounded-full border border-white/90 shadow-[0_0_8px_rgba(255,255,255,0.9)] -mb-1 pointer-events-none"
                  style={{ backgroundColor: cat.color }}
                />
              </div>
            );
          })() : selectedWeatherLayer === 'temp' ? (() => {
            const tempVal = getLocalTemperature(hoverCoords.lon, hoverCoords.lat);
            const color = getTempColorHex(tempVal);
            const cat = getThermalCategory(tempVal);
            const windKmh = computeGlobalWindSpeed(hoverCoords.lon, hoverCoords.lat);
            const displayTemp = tempUnit === 'F'
              ? `${Math.round((tempVal * 9) / 5 + 32)}°F`
              : `${Math.round(tempVal * 10) / 10}°C`;
            return (
              <div className="flex flex-col items-center mb-1">
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/20 bg-slate-950/90 backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.5)] text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full ring-2 ring-white/30 animate-pulse" style={{ backgroundColor: color }} />
                    <span style={{ color }} className="text-sm font-bold tracking-tight">{displayTemp}</span>
                  </div>
                  <div className="h-3.5 w-px bg-white/20" />
                  <span className="text-[11px] font-medium text-slate-300">{cat.label}</span>
                  <div className="h-3.5 w-px bg-white/20" />
                  <span className="text-[10px] font-mono text-slate-400">{windKmh} km/h</span>
                </div>
                {/* Pointer Arrow */}
                <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-slate-950/90" />
                {/* Target Crosshair Dot */}
                <div className="w-2 h-2 rounded-full border border-white/90 bg-white/40 shadow-[0_0_6px_rgba(255,255,255,0.9)] -mb-1 pointer-events-none" />
              </div>
            );
          })() : (
            <div className="flex flex-col items-center mb-1">
              <div className="apple-liquid-glass px-2.5 py-1 rounded-lg shadow-lg border border-white/20 bg-slate-950/85 backdrop-blur-md text-slate-200 text-[10px] font-mono tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                <span>
                  {Math.abs(hoverCoords.lat).toFixed(2)}°{hoverCoords.lat >= 0 ? 'N' : 'S'}, {Math.abs(hoverCoords.lon).toFixed(2)}°{hoverCoords.lon >= 0 ? 'E' : 'W'}
                </span>
                {selectedWeatherLayer === 'precip' && (() => {
                  const rainRate = estimateLocalRainRate(hoverCoords.lon, hoverCoords.lat, { cyclones: getActiveCyclones(), cloudburstEvent });
                  const dbz = getLocalRadarDbz(hoverCoords.lon, hoverCoords.lat, rainRate);
                  const probe = getRadarProbeInfo(dbz, rainRate, radarScheme);
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

      {/* 2.35 Celestial Astrolabe Station Inspection Card (Plan 5.3) */}
      {selectedWeatherLayer === 'precip' && hoveredRadarStation && (
        <div
          className="absolute z-30 pointer-events-none apple-liquid-glass px-3.5 py-2.5 rounded-xl border border-cyan-400/30 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 min-w-[210px]"
          style={{
            left: Math.min(window.innerWidth - 240, Math.max(16, hoveredRadarStation.x - 105)),
            top: Math.max(16, hoveredRadarStation.y - 130)
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[12px] font-bold text-white font-mono">
                {hoveredRadarStation.station.name}
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
              {hoveredRadarStation.station.callsign}
            </span>
          </div>

          <div className="space-y-1 text-[10px] font-mono text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Radar Type:</span>
              <span className="text-cyan-200 font-semibold">{hoveredRadarStation.station.band}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Scan Radius:</span>
              <span className="text-emerald-300 font-semibold">{hoveredRadarStation.station.radius} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Elevation:</span>
              <span className="text-amber-200">{hoveredRadarStation.station.elev}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Wavelength:</span>
              <span className="text-indigo-200">{hoveredRadarStation.station.wavelength}</span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-1 mt-1 text-[9px]">
              <span className="text-slate-400">Polarization:</span>
              <span className="text-emerald-400 font-bold">Dual-Pol (Z, ZDR)</span>
            </div>
          </div>
        </div>
      )}

      {/* 2.4 PluviaAtelier™ Floating Radar Playback Dock (Centered Above Legend Bar) */}
      {selectedWeatherLayer === 'precip' && (
        <div className={`absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom,0px))+6.25rem)] md:bottom-[78px] z-20 flex flex-col items-center gap-2 transition-all duration-300 pointer-events-none left-[62px] right-2.5 ${hasLeftDrawerOpen ? 'md:left-20 lg:left-[428px]' : 'md:left-20'
          } ${hasRightDrawerOpen ? 'md:right-[176px] lg:right-[372px]' : 'md:right-[176px]'
          }`}>
          {/* Main Floating Glass Dock Bar */}
          <div className="flex items-center gap-2 apple-liquid-glass px-3 py-1.5 rounded-full shadow-2xl pointer-events-auto border border-white/20 select-none overflow-x-auto scrollbar-none max-w-full">
            {/* Play / Pause Toggle Button with Animated Progress Indicator */}
            <button
              type="button"
              onClick={() => setIsRadarPlaying(!isRadarPlaying)}
              title={isRadarPlaying ? 'Pause Radar Loop' : 'Play Radar Loop'}
              className="relative w-6 h-6 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-white border border-cyan-400/40 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm shrink-0"
            >
              {isRadarPlaying ? (
                <>
                  <span className="absolute -inset-0.5 rounded-full border border-cyan-400/60 animate-ping opacity-75" />
                  <Pause className="w-3 h-3 fill-current" />
                </>
              ) : (
                <Play className="w-3 h-3 fill-current ml-0.5" />
              )}
            </button>

            {/* Step Back Button */}
            <button
              type="button"
              disabled={effectiveFrameIndex <= 0}
              onClick={() => {
                setIsRadarPlaying(false);
                setRadarFrameIndex(Math.max(0, effectiveFrameIndex - 1));
              }}
              title="Step to Previous 10m Frame"
              className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer shrink-0"
            >
              <SkipBack className="w-3 h-3" />
            </button>

            {/* Frame Scrubber Slider */}
            <div className="flex items-center gap-1.5 min-w-[90px] sm:min-w-[120px]">
              <input
                type="range"
                min={0}
                max={Math.max(0, radarFrames.length - 1)}
                value={effectiveFrameIndex}
                onChange={(e) => {
                  setIsRadarPlaying(false);
                  setRadarFrameIndex(Number(e.target.value));
                }}
                title="Scrub Doppler Radar Timeline"
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Step Forward Button */}
            <button
              type="button"
              disabled={effectiveFrameIndex >= radarFrames.length - 1}
              onClick={() => {
                setIsRadarPlaying(false);
                setRadarFrameIndex(Math.min(radarFrames.length - 1, effectiveFrameIndex + 1));
              }}
              title="Step to Next 10m Frame"
              className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer shrink-0"
            >
              <SkipForward className="w-3 h-3" />
            </button>

            {/* Timestamp & Live Badge */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/10 shrink-0">
              <span className="text-[11px] font-mono tabular-nums font-bold text-white tracking-tight">
                {radarTimestampTime || 'Scanning...'}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono tabular-nums font-bold border flex items-center gap-1 ${isLatestRadarFrame
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isLatestRadarFrame ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isLatestRadarFrame ? 'LIVE' : `-${minutesAgo}m`}
              </span>
            </div>

            {/* DWR 450km Range Rings Toggle */}
            <button
              type="button"
              onClick={() => setShowRadarRings(!showRadarRings)}
              title={showRadarRings ? "IMD DWR 450km Range Rings & Astrolabes Visible" : "DWR Range Rings Hidden"}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-mono transition-all cursor-pointer shrink-0 ${showRadarRings
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_8px_rgba(34,211,238,0.25)]'
                : 'bg-white/5 text-slate-400 hover:text-white border-white/10'
                }`}
            >
              <Compass className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">Rings</span>
            </button>
          </div>
        </div>
      )}

      {/* 2.47 AetherAura™ Liquid Glass AQI Station Telemetry Modal */}
      {selectedWeatherLayer === 'aqi' && selectedAqiStation && (
        <div className={`absolute top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-30 pointer-events-auto glass-panel-translucent p-4 rounded-3xl shadow-2xl border border-white/15 text-white left-[62px] right-2.5 sm:w-[320px] max-h-[calc(100dvh-10.5rem)] sm:max-h-[calc(100dvh-11rem)] overflow-y-auto scrollbar-none animate-fade-in select-none transition-all duration-300 ${hasRightDrawerOpen ? 'sm:left-auto sm:right-[372px]' : 'sm:left-auto sm:right-4'
          }`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-white/10">
            <div>
              <div className="flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
                <h4 className="font-bold text-sm text-white tracking-tight truncate">{selectedAqiStation.name}</h4>
              </div>
              <p className="text-[10px] font-mono text-slate-400">
                {selectedAqiStation.state || 'Sector'} • {selectedAqiStation.lat.toFixed(2)}°, {selectedAqiStation.lon.toFixed(2)}°
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAqiStation(null)}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* AQI Score & Category Pill */}
          <div className="flex items-center justify-between gap-3 mb-2.5 apple-liquid-glass-well p-2.5 rounded-2xl border border-white/10">
            <div>
              <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">Air Quality Index</span>
              <span className="text-2xl font-black font-mono tracking-tight" style={{ color: selectedAqiStation.color }}>
                {selectedAqiStation.aqi}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border"
                style={{
                  backgroundColor: `${selectedAqiStation.color}25`,
                  borderColor: `${selectedAqiStation.color}60`,
                  color: selectedAqiStation.color
                }}
              >
                {selectedAqiStation.category}
              </span>
              <span className="text-[9px] font-mono text-slate-400 mt-1">
                Dominant: <strong className="text-white">{selectedAqiStation.dominantPollutant}</strong>
              </span>
            </div>
          </div>

          {/* Health Advisory & Mask Guidance */}
          <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/10 text-[10.5px] leading-relaxed text-slate-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p>{selectedAqiStation.healthAdvice}</p>
              {selectedAqiStation.maskRecommended && (
                <p className="text-amber-300 font-semibold mt-1 flex items-center gap-1">
                  <span>😷</span> N95 / FFP2 mask advised outdoors
                </p>
              )}
            </div>
          </div>

          {/* Pollutant Breakdown Gauges */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5 text-[10px] font-mono">
            <div className="apple-liquid-glass-well p-2 rounded-xl border border-white/10">
              <span className="text-slate-400 block">PM2.5 (Fine)</span>
              <span className="font-bold text-white text-xs">{selectedAqiStation.pm2_5} <span className="text-[8px] text-slate-400 font-normal">μg/m³</span></span>
            </div>
            <div className="apple-liquid-glass-well p-2 rounded-xl border border-white/10">
              <span className="text-slate-400 block">PM10 (Coarse)</span>
              <span className="font-bold text-white text-xs">{selectedAqiStation.pm10} <span className="text-[8px] text-slate-400 font-normal">μg/m³</span></span>
            </div>
            <div className="apple-liquid-glass-well p-2 rounded-xl border border-white/10">
              <span className="text-slate-400 block">NO₂ (Dioxide)</span>
              <span className="font-bold text-white text-xs">{selectedAqiStation.no2} <span className="text-[8px] text-slate-400 font-normal">μg/m³</span></span>
            </div>
            <div className="apple-liquid-glass-well p-2 rounded-xl border border-white/10">
              <span className="text-slate-400 block">O₃ (Ozone)</span>
              <span className="font-bold text-white text-xs">{selectedAqiStation.o3} <span className="text-[8px] text-slate-400 font-normal">μg/m³</span></span>
            </div>
          </div>

          {/* Sync Freshness Footer */}
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-1.5 border-t border-white/10">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {selectedAqiStation.isEstimated ? 'Regional Baseline' : 'Copernicus CAMS Live'}
            </span>
            <span>Next sync in {aqiMinutesRemaining}m</span>
          </div>
        </div>
      )}

      {/* 5. Clean Basic Map Navigation Controls (Horizontal Bottom-Right Pill) */}
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:bottom-6 right-2.5 sm:right-4 z-25 flex flex-row items-center gap-0.5 sm:gap-1 glass-panel-translucent p-1 sm:p-1.5 rounded-full shadow-2xl pointer-events-auto transition-all duration-300">
        <button
          type="button"
          onClick={handleToggleNorthLock}
          title={
            isNorthLocked
              ? 'North Locked (Click to unlock free rotation)'
              : Math.abs(mapBearing) > 1
                ? `Free Rotation (${Math.round(mapBearing)}°) — Click to lock North`
                : 'Free Rotation (Click to lock North)'
          }
          aria-label={isNorthLocked ? 'Unlock North orientation' : 'Lock map orientation to North'}
          aria-pressed={isNorthLocked}
          className={`relative p-1.5 xs:p-2 rounded-full transition-all duration-300 cursor-pointer flex items-center justify-center active:scale-95 ${
            isNorthLocked
              ? 'bg-cyan-500/25 text-white border border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.28)]'
              : Math.abs(mapBearing) > 1
                ? 'bg-white/15 text-white hover:bg-white/20 border border-white/25'
                : 'text-slate-300 hover:text-white hover:bg-white/15 border border-transparent'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5 xs:w-4 xs:h-4 transition-transform duration-300 ease-out"
            style={{ transform: `rotate(${-mapBearing}deg)` }}
            aria-hidden="true"
          >
            <polygon points="12,2 15.5,12 12,10.5 8.5,12" fill="#ef4444" />
            <polygon points="12,22 15.5,12 12,13.5 8.5,12" fill="#cbd5e1" />
          </svg>
          {isNorthLocked && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
          )}
        </button>

        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 xs:p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 xs:p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer active:scale-95"
        >
          <Minus className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
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
          className={`p-1.5 xs:p-2 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 ${isThunderMuted
            ? 'text-slate-400 hover:text-white hover:bg-white/15'
            : 'text-amber-300 bg-amber-400/20 border border-amber-400/50 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
            }`}
        >
          {isThunderMuted ? <VolumeX className="w-3.5 h-3.5 xs:w-4 xs:h-4" /> : <Volume2 className="w-3.5 h-3.5 xs:w-4 xs:h-4" />}
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
          className="p-1.5 xs:p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center font-bold text-xs active:scale-95"
        >
          <span className="text-[9.5px] xs:text-[10px] tracking-wider font-semibold">IND</span>
        </button>
      </div>

      {/* 2.5 Unified Lower Command Bar: Scale (Left) + Legend (Center) */}
      <div className={`absolute bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:bottom-6 z-20 flex flex-col-reverse md:grid md:grid-cols-[auto_minmax(0,1fr)] items-start md:items-center gap-2.5 md:gap-3 pointer-events-none select-none transition-all duration-300 left-[62px] right-2.5 md:right-[236px] ${hasLeftDrawerOpen ? 'md:left-20 lg:left-[428px]' : 'md:left-20'
        }`}>
        {/* 1. Left: Dynamic Map Scale Indicator */}
        <div className="pointer-events-auto justify-self-start shrink-0 h-10 md:h-auto flex items-center">
          <button
            type="button"
            onClick={() => setScaleUnit((u) => (u === 'metric' ? 'imperial' : 'metric'))}
            title={`Click to toggle units (${scaleUnit === 'metric' ? 'Metric: km' : 'Imperial: mi'})`}
            className="flex items-center gap-1.5 sm:gap-2 text-[9.5px] sm:text-[10px] font-mono text-slate-100 apple-liquid-glass-pill px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-xl cursor-pointer hover:bg-white/20 transition-all active:scale-95 border border-white/20 shrink-0"
          >
            <span
              style={{ width: `${scaleInfo.widthPx}px` }}
              className="max-w-[44px] xs:max-w-none h-1 bg-white border-l-2 border-r-2 border-white shadow-[0_0_6px_#fff] transition-all duration-75"
            />
            <span className="font-semibold whitespace-nowrap">{scaleInfo.label}</span>
          </button>
        </div>

        {/* 2. Center: Active Weather Variable Legend Bar */}
        <div className="pointer-events-auto self-center md:justify-self-center min-w-0 w-full flex items-center justify-center max-w-full">
          {selectedWeatherLayer === 'aqi' ? (
            <AqiLegendBar
              minutesRemaining={aqiMinutesRemaining}
              isLoading={isAqiLoading}
              activeFilter={aqiCategoryFilter}
              onSelectCategory={setAqiCategoryFilter}
              hoveredAqi={hoverCoords ? computeInterpolatedAqi(hoverCoords.lon, hoverCoords.lat) : null}
              onForceRefresh={async () => {
                setIsAqiLoading(true);
                try {
                  const fresh = await getLiveAirQualityNetwork(null, true);
                  setAqiDataMap(fresh);
                  setAqiMinutesRemaining(getAqiCacheMinutesRemaining());
                } catch (e) {
                  console.warn(e);
                } finally {
                  setIsAqiLoading(false);
                }
              }}
            />
          ) : selectedWeatherLayer === 'precip' ? (
            (() => {
              const activePalette = RADAR_ART_PALETTES.find((p) => p.id === radarScheme) || RADAR_ART_PALETTES[0];
              const stops = activePalette.stops || RADAR_DBZ_STOPS;
              const gradientCss = `linear-gradient(to right, ${stops.map((s, idx) => `${s.color} ${(idx / (stops.length - 1)) * 100}%`).join(', ')})`;

              return (
                <div className="flex items-center gap-2 sm:gap-3 glass-panel-translucent px-3 sm:px-4 py-1.5 rounded-full shadow-2xl border border-white/20 select-none max-w-full overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-white shrink-0">
                    <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Rain Intensity:</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9.5px] font-sans font-medium text-cyan-300">Light</span>
                    <div
                      className="relative w-20 sm:w-32 h-2.5 rounded-full shadow-inner border border-black/40 ring-1 ring-white/15 overflow-hidden"
                      style={{ background: gradientCss }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/30 pointer-events-none" />
                    </div>
                    <span className="text-[9.5px] font-sans font-bold text-rose-300">Torrent</span>
                  </div>
                  <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-white/10 text-[9.5px] font-mono tabular-nums shrink-0">
                    {stops.map((st) => (
                      <div key={st.dbz} className="flex items-center gap-1" title={`${st.desc} (${st.label} dBZ)`}>
                        <span className="w-2.5 h-2.5 rounded-full shadow-sm ring-1 ring-white/25 shrink-0" style={{ backgroundColor: st.color }} />
                        <span className="text-slate-200 font-semibold">{st.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          ) : (selectedWeatherLayer === 'temp' || selectedWeatherLayer === 'wind' || selectedWeatherLayer === 'convective') ? (
            <TemperatureLegendBar
              activeLayer={selectedWeatherLayer}
              tempUnit={tempUnit}
              onToggleTempUnit={onToggleTempUnit}
              windUnit={windUnit}
              onToggleWindUnit={() => setWindUnit((prev) => (prev === 'km/h' ? 'kt' : 'km/h'))}
              hoveredTemp={hoverCoords ? getCachedPointTemperature(hoverCoords.lat, hoverCoords.lon) : null}
            />
          ) : null}
        </div>

        {/* 3. Right Spacer to keep Legend centered */}
        <div className="hidden" aria-hidden="true" />
      </div>
    </div>
  );
}
