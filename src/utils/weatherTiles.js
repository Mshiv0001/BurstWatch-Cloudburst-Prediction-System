/**
 * Global Meteorological Slippy Map Tile Services & Layer Registry
 *
 * Provides continuous, high-performance raster layers:
 * - 2m Air Temperature: Procedurally generated continuous thermodynamic field (0ms latency, zero tile holes)
 * - Precipitation / Rain Radar: Doppler radar reflectivity from RainViewer
 */

import * as maplibregl from 'maplibre-gl';
import { 
  computeGlobalThermodynamicTemp, 
  getInterpolatedTempColor,
  computeGlobalWindSpeed,
  getInterpolatedWindColor 
} from './temperatureUtils';

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
    opacity: 0.70,
    unit: '°C',
    description: 'Seamless continuous global thermodynamic temperature isotherms'
  },
  wind: {
    id: 'wind',
    layerKey: 'wind',
    sourceId: 'weatherapi-wind-source',
    layerId: 'weatherapi-wind-layer',
    label: 'Wind Speed',
    shortLabel: 'Wind',
    icon: 'Wind',
    type: 'raster',
    opacity: 0.65,
    unit: 'km/h',
    description: 'Continuous global atmospheric wind velocity field and streamline flow'
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
    opacity: 0.78,
    unit: 'dBZ',
    description: 'RainViewer Universal Blue radar reflectivity (dBZ)'
  },
};

const tileCache = new Map();
const MAX_CACHE_SIZE = 1024;
let isProtocolRegistered = false;

/**
 * Procedurally renders a 256x256 thermodynamic temperature tile
 * Fully continuous ($C^\infty$) across all Web Mercator tile borders and the 180° meridian
 */
async function generateThermodynamicTile(z, x, y) {
  const cacheKey = `${z}/${x}/${y}`;
  if (tileCache.has(cacheKey)) {
    return tileCache.get(cacheKey);
  }

  const n = 1 << z;
  const GRID_SIZE = 96; // 96x96 high-resolution grid with bilinear scaling to 256x256
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
      const [r, g, b, a] = getInterpolatedTempColor(temp, 0.72);

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

  return arrayBuffer;
}

const windTileCache = new Map();

/**
 * Procedurally renders a 256x256 atmospheric wind speed tile
 * Color-mapped according to the Beaufort / Ventusky wind velocity spectrum
 */
async function generateWindTile(z, x, y) {
  const cacheKey = `wind/${z}/${x}/${y}`;
  if (windTileCache.has(cacheKey)) {
    return windTileCache.get(cacheKey);
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
      const [r, g, b, a] = getInterpolatedWindColor(windKmh, 0.65);

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

  return arrayBuffer;
}

/**
 * Registers custom 'thermo-temp' and 'thermo-wind' protocols with MapLibre GL JS
 * Robustly normalizes wrapping and negative coordinates to prevent missing tile blanks
 */
export function registerWeatherApiProtocol() {
  if (isProtocolRegistered || typeof window === 'undefined') return;

  try {
    maplibregl.removeProtocol('thermo-temp');
    maplibregl.removeProtocol('thermo-wind');
  } catch (e) {}

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
 * Routes 'tmp2m' and 'temp' to thermo-temp, and 'wind' to thermo-wind
 */
export function getWeatherApiTileUrl(layerKey = 'tmp2m', dateOrOffset = 0) {
  registerWeatherApiProtocol();
  if (layerKey === 'tmp2m' || layerKey === 'temp') {
    return 'thermo-temp://tile/{z}/{x}/{y}';
  }
  if (layerKey === 'wind') {
    return 'thermo-wind://tile/{z}/{x}/{y}';
  }
  const timestamp = getWeatherApiTimestamp(dateOrOffset);
  return `https://weathermaps.weatherapi.com/${layerKey}/tiles/${timestamp}/{z}/{x}/{y}.png`;
}

// Automatically register protocol on module load in browser environment
if (typeof window !== 'undefined') {
  registerWeatherApiProtocol();
}
