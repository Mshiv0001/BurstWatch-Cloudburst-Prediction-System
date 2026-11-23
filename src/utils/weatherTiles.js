/**
 * Global Meteorological Slippy Map Tile Services & Layer Registry
 *
 * Provides continuous, high-performance raster layers:
 * - 2m Air Temperature: Procedurally generated continuous thermodynamic field (0ms latency, zero tile holes)
 * - Precipitation / Rain Radar: Doppler radar reflectivity from RainViewer
 */

import * as maplibregl from 'maplibre-gl';
import { omProtocol } from '@openmeteo/weather-map-layer';
import { 
  OPENMETEO_ECMWF_TEMP_URL,
  computeGlobalWindSpeed,
  getInterpolatedWindColor 
} from './temperatureUtils';

export { OPENMETEO_ECMWF_TEMP_URL };

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
    sourceId: 'openmeteo-temp-source',
    layerId: 'openmeteo-temp-layer',
    label: 'Temperature',
    shortLabel: 'Temp',
    icon: 'Thermometer',
    type: 'raster',
    url: OPENMETEO_ECMWF_TEMP_URL,
    opacity: 0.72,
    unit: '°C',
    description: 'ECMWF IFS live 2m air temperature (Open-Meteo)'
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
    opacity: 0.0,
    unit: 'km/h',
    description: 'Beaufort speed-colored streamline particle flow (zero background fill)'
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

const windTileCache = new Map();
const MAX_CACHE_SIZE = 1024;
let isProtocolRegistered = false;

/**
 * Procedurally renders a 256x256 atmospheric wind speed tile
 * Color-mapped according to the Beaufort / Ventusky wind velocity spectrum
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

  return arrayBuffer.slice(0);
}

/**
 * Registers custom 'thermo-wind' and Open-Meteo 'om' protocols with MapLibre GL JS
 */
export function registerWeatherApiProtocol() {
  if (isProtocolRegistered || typeof window === 'undefined') return;

  try {
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
 */
export function getWeatherApiTileUrl(layerKey = 'tmp2m', dateOrOffset = 0) {
  registerWeatherApiProtocol();
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
