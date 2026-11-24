/**
 * Global Meteorological Slippy Map Tile Services & Layer Registry
 *
 * Provides continuous, high-performance raster layers:
 * - 2m Air Temperature: Procedurally generated continuous thermodynamic field (0ms latency, zero tile holes)
 * - Precipitation / Rain Radar: Doppler radar reflectivity from RainViewer
 * - Wind Speed: Procedural Beaufort streamlines
 */

import * as maplibregl from 'maplibre-gl';
import * as openMeteoLayer from '@openmeteo/weather-map-layer';
const { omProtocol, addMapboxProtocolSupport, getValueFromLatLong } = openMeteoLayer;

if (typeof window !== 'undefined') {
  window.openMeteoLayer = openMeteoLayer;
  window.addMapboxProtocolSupport = addMapboxProtocolSupport;
}
import { 
  computeGlobalThermodynamicTemp, 
  getInterpolatedTempColor,
  computeTopographicHillshade,
  computeGlobalWindSpeed,
  getInterpolatedWindColor,
  WIND_ART_PALETTES
} from './temperatureUtils';
import { generateAqiTile } from './aqiTiles';
import { sampleAeroSilkVector } from '../services/aeroSilkService';

export { WIND_ART_PALETTES };

export const OPENMETEO_ECMWF_TEMP_URL = 'om://https://openmeteo.s3.amazonaws.com/data_spatial/ecmwf_ifs/latest.json?variable=temperature_2m';

export const WEATHER_LAYERS = {
  convective: {
    id: 'convective',
    label: 'Cloudburst Risk',
    shortLabel: 'Cloudburst',
    icon: 'Zap',
    type: 'webgl-heatmap',
    description: 'Dynamic convective instability, CAPE, and cloudburst hazard plume'
  },
  temp: {
    id: 'temp',
    layerKey: 'tmp2m',
    sourceId: 'weatherapi-temp-source',
    layerId: 'weatherapi-temp-layer',
    label: 'Temperature',
    shortLabel: 'Temp',
    icon: 'Thermometer',
    type: 'raster',
    tileSize: 256,
    opacity: 0.88,
    unit: '°C',
    description: 'Dynamic numerical weather prediction thermodynamic field (Ventusky & Windy style)'
  },
  wind: {
    id: 'wind',
    layerKey: 'wind',
    sourceId: 'weatherapi-wind-source',
    layerId: 'weatherapi-wind-layer',
    label: 'Wind Speed',
    shortLabel: 'Wind',
    icon: 'Wind',
    type: 'vector-streamlines',
    opacity: 0.72,
    unit: 'km/h',
    description: 'AeroAtelier™ artistic velocity field & streamline particle flow'
  },
  precip: {
    id: 'precip',
    layerKey: 'precip',
    sourceId: 'weatherapi-precip-source',
    layerId: 'weatherapi-precip-layer',
    label: 'Rain Radar',
    shortLabel: 'Rain',
    icon: 'CloudRain',
    type: 'raster',
    opacity: 0.86,
    unit: 'dBZ',
    description: 'Ethereal Doppler radar reflectivity & precipitation nowcast (dBZ)'
  },
  aqi: {
    id: 'aqi',
    layerKey: 'aqi',
    sourceId: 'weatherapi-aqi-source',
    layerId: 'weatherapi-aqi-layer',
    label: 'Air Quality (AQI)',
    shortLabel: 'AQI',
    icon: 'Gauge',
    type: 'raster',
    tileSize: 256,
    opacity: 0.84,
    unit: 'AQI',
    description: 'Continuous planetary atmospheric air quality raster field with synoptic Iso-AQI contours'
  },
};

export const RADAR_ART_PALETTES = [
  {
    id: 'nordic',
    name: 'Nordic Opal',
    subtitle: 'Apple Weather Ethereal',
    schemeId: 8,
    auraColor: 'rgba(56, 189, 248, 0.45)',
    accentGradient: 'from-sky-400 via-indigo-400 to-purple-400',
    description: 'Soothing glaucous cyans, frosty periwinkles and glowing moonlit amethysts',
    stops: [
      { dbz: 15, label: '15', color: '#38bdf8', desc: 'Mist' },
      { dbz: 25, label: '25', color: '#818cf8', desc: 'Drizzle' },
      { dbz: 35, label: '35', color: '#a78bfa', desc: 'Moderate' },
      { dbz: 45, label: '45', color: '#c084fc', desc: 'Heavy' },
      { dbz: 55, label: '55', color: '#f43f5e', desc: 'Severe' },
      { dbz: 65, label: '65+', color: '#fda4af', desc: 'Torrent' }
    ]
  },
  {
    id: 'monet',
    name: "Monet's Promenade",
    subtitle: 'Impressionist Watercolor',
    schemeId: 2,
    auraColor: 'rgba(45, 212, 191, 0.45)',
    accentGradient: 'from-teal-400 via-cyan-400 to-indigo-500',
    description: 'Impressionistic sea-green washes, misty wisteria lilacs and deep indigo clouds',
    stops: [
      { dbz: 15, label: '15', color: '#2dd4bf', desc: 'Mist' },
      { dbz: 25, label: '25', color: '#38bdf8', desc: 'Drizzle' },
      { dbz: 35, label: '35', color: '#6366f1', desc: 'Moderate' },
      { dbz: 45, label: '45', color: '#a855f7', desc: 'Squall' },
      { dbz: 55, label: '55', color: '#ec4899', desc: 'Downpour' },
      { dbz: 65, label: '65+', color: '#f43f5e', desc: 'Torrent' }
    ]
  },
  {
    id: 'bioluminescent',
    name: 'Bioluminescent Tide',
    subtitle: 'Abyssean Starlight',
    schemeId: 8,
    auraColor: 'rgba(20, 184, 166, 0.50)',
    accentGradient: 'from-emerald-400 via-teal-400 to-violet-500',
    description: 'Abyssean midnight teals, glowing turquoise starlight and electric violet squalls',
    stops: [
      { dbz: 15, label: '15', color: '#14b8a6', desc: 'Mist' },
      { dbz: 25, label: '25', color: '#06b6d4', desc: 'Plankton' },
      { dbz: 35, label: '35', color: '#3b82f6', desc: 'Cyan Glow' },
      { dbz: 45, label: '45', color: '#8b5cf6', desc: 'Abyss' },
      { dbz: 55, label: '55', color: '#d946ef', desc: 'Electric' },
      { dbz: 65, label: '65+', color: '#f43f5e', desc: 'Burst' }
    ]
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2049',
    subtitle: 'Neo-Tokyo Storm',
    schemeId: 3,
    auraColor: 'rgba(236, 72, 153, 0.45)',
    accentGradient: 'from-cyan-400 via-amber-400 to-rose-500',
    description: 'Charcoal base with electric turquoise squalls, hot magenta cores and neon flashpoints',
    stops: [
      { dbz: 15, label: '15', color: '#06b6d4', desc: 'Neon Fog' },
      { dbz: 25, label: '25', color: '#10b981', desc: 'Turquoise' },
      { dbz: 35, label: '35', color: '#f59e0b', desc: 'Amber Glow' },
      { dbz: 45, label: '45', color: '#f43f5e', desc: 'Hot Magenta' },
      { dbz: 55, label: '55', color: '#d946ef', desc: 'Electric' },
      { dbz: 65, label: '65+', color: '#fb7185', desc: 'Hyperstorm' }
    ]
  }
];

export const RADAR_SCHEMES = RADAR_ART_PALETTES;

export function getRainViewerTileUrl(path, paletteOrScheme = 'nordic', tileSize = 512) {
  const selected = RADAR_ART_PALETTES.find((s) => s.id === paletteOrScheme || s.id === 'nordic') || RADAR_ART_PALETTES[0];
  const schemeCode = selected.schemeId;
  return `https://tilecache.rainviewer.com${path}/${tileSize}/{z}/{x}/{y}/${schemeCode}/1_1.png`;
}

const tileCache = new Map();
const windTileCache = new Map();
const MAX_CACHE_SIZE = 1024;
let isProtocolRegistered = false;

/**
 * Procedurally renders a 256x256 thermodynamic temperature tile
 * Fully continuous across all Web Mercator tile borders and the 180° meridian
 */
async function generateThermodynamicTile(z, x, y) {
  const cacheKey = `v10/${z}/${x}/${y}`;
  if (tileCache.has(cacheKey)) {
    return tileCache.get(cacheKey).slice(0);
  }

  const n = 1 << z;
  const GRID_SIZE = 48; // High-performance 48x48 numerical grid with GPU bilinear scaling to 256x256
  const TILE_SIZE = 256;

  let smallCanvas, smallCtx, bigCanvas, bigCtx;
  if (typeof OffscreenCanvas !== 'undefined') {
    smallCanvas = new OffscreenCanvas(GRID_SIZE, GRID_SIZE);
    smallCtx = smallCanvas.getContext('2d');
    bigCanvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    bigCtx = bigCanvas.getContext('2d');
  } else {
    smallCanvas = document.createElement('canvas');
    smallCanvas.width = GRID_SIZE;
    smallCanvas.height = GRID_SIZE;
    smallCtx = smallCanvas.getContext('2d');
    bigCanvas = document.createElement('canvas');
    bigCanvas.width = TILE_SIZE;
    bigCanvas.height = TILE_SIZE;
    bigCtx = bigCanvas.getContext('2d');
  }

  const imgData = smallCtx.createImageData(GRID_SIZE, GRID_SIZE);
  const data = imgData.data;

  for (let gy = 0; gy < GRID_SIZE; gy++) {
    // py normalized between y and y+1
    const py = y + (gy + 0.5) / GRID_SIZE;
    const mercY = Math.PI * (1 - (2 * py) / n);
    const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(mercY)) - Math.PI / 2);

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      // px normalized between x and x+1
      const px = x + (gx + 0.5) / GRID_SIZE;
      const lon = (px / n) * 360 - 180;

      const temp = computeGlobalThermodynamicTemp(lon, lat);
      const hillshade = computeTopographicHillshade(lon, lat);

      // Calibrated Ventusky/Windy luminous alpha depth:
      // High-vibrancy optical depth against the dark slate canvas
      let dynamicAlpha;
      if (temp > 35) {
        dynamicAlpha = 0.84;
      } else if (temp > 25) {
        dynamicAlpha = 0.74 + ((temp - 25) / 10) * 0.10;
      } else if (temp < -10) {
        dynamicAlpha = 0.82;
      } else if (temp < 0) {
        dynamicAlpha = 0.74 + ((0 - temp) / 10) * 0.08;
      } else {
        dynamicAlpha = 0.72;
      }

      const [r, g, b, a] = getInterpolatedTempColor(temp, dynamicAlpha, hillshade);

      const idx = (gy * GRID_SIZE + gx) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  smallCtx.putImageData(imgData, 0, 0);

  // Smooth bilinear interpolation eliminates all grid steps and hard seams
  bigCtx.imageSmoothingEnabled = true;
  bigCtx.imageSmoothingQuality = 'high';
  bigCtx.drawImage(smallCanvas, 0, 0, TILE_SIZE, TILE_SIZE);

  let arrayBuffer;
  if (bigCanvas.convertToBlob) {
    const blob = await bigCanvas.convertToBlob({ type: 'image/png' });
    arrayBuffer = await blob.arrayBuffer();
  } else {
    const blob = await new Promise((resolve) => bigCanvas.toBlob(resolve, 'image/png'));
    arrayBuffer = await blob.arrayBuffer();
  }

  if (tileCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = tileCache.keys().next().value;
    tileCache.delete(oldestKey);
  }
  tileCache.set(cacheKey, arrayBuffer);

  return arrayBuffer.slice(0);
}

/**
 * Procedurally renders a 256x256 atmospheric wind speed tile
 * Color-mapped according to the canonical master wind velocity spectrum with topographic hillshade.
 */
async function generateWindTile(z, x, y) {
  const cacheKey = `wind/${z}/${x}/${y}`;
  if (windTileCache.has(cacheKey)) {
    return windTileCache.get(cacheKey).slice(0);
  }

  const n = 1 << z;
  const GRID_SIZE = 96;
  const TILE_SIZE = 256;

  let smallCanvas, smallCtx, bigCanvas, bigCtx;
  if (typeof OffscreenCanvas !== 'undefined') {
    smallCanvas = new OffscreenCanvas(GRID_SIZE, GRID_SIZE);
    smallCtx = smallCanvas.getContext('2d');
    bigCanvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    bigCtx = bigCanvas.getContext('2d');
  } else {
    smallCanvas = document.createElement('canvas');
    smallCanvas.width = GRID_SIZE;
    smallCanvas.height = GRID_SIZE;
    smallCtx = smallCanvas.getContext('2d');
    bigCanvas = document.createElement('canvas');
    bigCanvas.width = TILE_SIZE;
    bigCanvas.height = TILE_SIZE;
    bigCtx = bigCanvas.getContext('2d');
  }

  const imgData = smallCtx.createImageData(GRID_SIZE, GRID_SIZE);
  const data = imgData.data;

  for (let gy = 0; gy < GRID_SIZE; gy++) {
    const py = y + (gy + 0.5) / GRID_SIZE;
    const mercY = Math.PI * (1 - (2 * py) / n);
    const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(mercY)) - Math.PI / 2);

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const px = x + (gx + 0.5) / GRID_SIZE;
      const lon = (px / n) * 360 - 180;

      const windKmh = computeGlobalWindSpeed(lon, lat);
      const hillshade = computeTopographicHillshade(lon, lat);
      let dynamicAlpha = 0.65;
      if (windKmh > 75) {
        dynamicAlpha = 0.78;
      } else if (windKmh > 35) {
        dynamicAlpha = 0.68;
      } else {
        dynamicAlpha = 0.52;
      }
      const [r, g, b, a] = getInterpolatedWindColor(windKmh, dynamicAlpha, hillshade);

      const idx = (gy * GRID_SIZE + gx) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  smallCtx.putImageData(imgData, 0, 0);

  bigCtx.imageSmoothingEnabled = true;
  bigCtx.imageSmoothingQuality = 'high';
  bigCtx.drawImage(smallCanvas, 0, 0, TILE_SIZE, TILE_SIZE);

  let arrayBuffer;
  if (bigCanvas.convertToBlob) {
    const blob = await bigCanvas.convertToBlob({ type: 'image/png' });
    arrayBuffer = await blob.arrayBuffer();
  } else {
    const blob = await new Promise((resolve) => bigCanvas.toBlob(resolve, 'image/png'));
    arrayBuffer = await blob.arrayBuffer();
  }

  if (windTileCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = windTileCache.keys().next().value;
    windTileCache.delete(oldestKey);
  }
  windTileCache.set(cacheKey, arrayBuffer);

  return arrayBuffer.slice(0);
}

/**
 * Registers custom 'thermo-temp' and 'thermo-wind' protocols with MapLibre GL JS
 */
export function registerWeatherApiProtocol() {
  if (isProtocolRegistered || typeof window === 'undefined') return;

  try {
    maplibregl.removeProtocol('thermo-temp');
    maplibregl.removeProtocol('thermo-wind');
    maplibregl.removeProtocol('om');
  } catch (e) {}

  if (typeof omProtocol === 'function') {
    try {
      maplibregl.addProtocol('om', omProtocol);
    } catch (e) {
      console.warn('Failed to register Open-Meteo om protocol:', e);
    }
  }

  maplibregl.addProtocol('thermo-temp', async (requestParameters) => {
    const match = requestParameters.url.match(/thermo-temp:\/\/tile\/(-?\d+)\/(-?\d+)\/(-?\d+)/);
    if (!match) {
      throw new Error(`Invalid thermodynamic tile request: ${requestParameters.url}`);
    }

    const z = parseInt(match[1], 10);
    const rawX = parseInt(match[2], 10);
    const rawY = parseInt(match[3], 10);

    const n = 1 << z;
    const x = ((rawX % n) + n) % n;
    const y = Math.max(0, Math.min(n - 1, rawY));

    const buffer = await generateThermodynamicTile(z, x, y);
    return { data: buffer };
  });

  maplibregl.addProtocol('thermo-wind', async (requestParameters) => {
    const match = requestParameters.url.match(/thermo-wind:\/\/tile\/(-?\d+)\/(-?\d+)\/(-?\d+)/);
    if (!match) {
      throw new Error(`Invalid wind speed tile request: ${requestParameters.url}`);
    }

    const z = parseInt(match[1], 10);
    const rawX = parseInt(match[2], 10);
    const rawY = parseInt(match[3], 10);

    const n = 1 << z;
    const x = ((rawX % n) + n) % n;
    const y = Math.max(0, Math.min(n - 1, rawY));

    const buffer = await generateWindTile(z, x, y);
    return { data: buffer };
  });

  maplibregl.addProtocol('thermo-aqi', async (requestParameters) => {
    const match = requestParameters.url.match(/thermo-aqi:\/\/tile\/(-?\d+)\/(-?\d+)\/(-?\d+)/);
    if (!match) {
      throw new Error(`Invalid AQI tile request: ${requestParameters.url}`);
    }

    const z = parseInt(match[1], 10);
    const rawX = parseInt(match[2], 10);
    const rawY = parseInt(match[3], 10);

    const n = 1 << z;
    const x = ((rawX % n) + n) % n;
    const y = Math.max(0, Math.min(n - 1, rawY));

    const buffer = await generateAqiTile(z, x, y);
    return { data: buffer };
  });

  isProtocolRegistered = true;
}

/**
 * Returns formatted UTC timestamp (yyyyMMddHH)
 */
export function getWeatherApiTimestamp(dateOrOffset = 0) {
  let d;
  if (dateOrOffset instanceof Date) {
    d = dateOrOffset;
  } else {
    d = new Date();
    if (typeof dateOrOffset === 'number' && dateOrOffset !== 0) {
      d.setUTCHours(d.getUTCHours() + dateOrOffset);
    }
  }

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');

  return `${yyyy}${mm}${dd}${hh}`;
}

/**
 * Generates Tile URL template
 */
export function getWeatherApiTileUrl(layerKey = 'tmp2m', dateOrOffset = 0) {
  registerWeatherApiProtocol();
  if (layerKey === 'tmp2m' || layerKey === 'temp') {
    return 'thermo-temp://tile/{z}/{x}/{y}';
  }
  if (layerKey === 'wind') {
    return 'thermo-wind://tile/{z}/{x}/{y}';
  }
  if (layerKey === 'aqi') {
    return 'thermo-aqi://tile/{z}/{x}/{y}';
  }
  const timestamp = getWeatherApiTimestamp(dateOrOffset);
  return `https://weathermaps.weatherapi.com/${layerKey}/tiles/${timestamp}/{z}/{x}/{y}.png`;
}

// Automatically register protocol on module load in browser environment
if (typeof window !== 'undefined') {
  registerWeatherApiProtocol();
}
