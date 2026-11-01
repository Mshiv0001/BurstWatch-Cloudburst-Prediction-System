/**
 * WeatherAPI.com Global Slippy Map Tile Services & Layer Registry
 *
 * Provides pre-rendered global raster tiles for:
 * - 2m Air Temperature ('tmp2m')
 * - Precipitation ('precip'; RainViewer radar is used by the map)
 *
 * Includes automatic Antimeridian Seam Healing to seal the 3-pixel transparent gap
 * left at the 180° meridian in WeatherAPI raw raster tiles.
 */

import * as maplibregl from 'maplibre-gl';

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
    opacity: 0.68,
    unit: '°C',
    description: 'Global 2m thermodynamic temperature isotherms from WeatherAPI'
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

let isProtocolRegistered = false;

/**
 * Seals the 180° / -180° meridian seam by filling the 3 transparent columns at the edge of WeatherAPI tiles
 */
async function healWeatherTileSeam(blob, isRightEdge) {
  const bitmap = await createImageBitmap(blob);
  let canvas, ctx;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(256, 256);
    ctx = canvas.getContext('2d');
  } else {
    canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    ctx = canvas.getContext('2d');
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  if (isRightEdge) {
    // WeatherAPI tiles cut off at column ~252, leaving cols 253-255 transparent.
    // Stretch column 252 (the last valid data column) across 253, 254, 255.
    ctx.drawImage(canvas, 252, 0, 1, 256, 253, 0, 3, 256);
  } else {
    // Replicate column 1 to column 0 if needed
    ctx.drawImage(canvas, 1, 0, 1, 256, 0, 0, 1, 256);
  }

  if (canvas.convertToBlob) {
    const healedBlob = await canvas.convertToBlob({ type: 'image/png' });
    return await healedBlob.arrayBuffer();
  } else {
    const healedBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return await healedBlob.arrayBuffer();
  }
}

/**
 * Registers custom 'weatherapi' protocol with MapLibre to seamlessly heal antimeridian tile borders
 */
export function registerWeatherApiProtocol() {
  if (isProtocolRegistered || typeof window === 'undefined') return;

  try {
    maplibregl.removeProtocol('weatherapi');
  } catch (e) {}

  maplibregl.addProtocol('weatherapi', async (requestParameters, abortController) => {
    const httpUrl = requestParameters.url.replace(/^weatherapi:\/\//, 'https://');
    const response = await fetch(httpUrl, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`WeatherAPI tile request failed: ${response.statusText}`);
    }
    const blob = await response.blob();

    // Check if this tile borders the 180° / -180° antimeridian (x === 2^z - 1 or x === 0)
    const match = httpUrl.match(/\/(\d+)\/(\d+)\/(\d+)\.png/);
    if (match) {
      const z = parseInt(match[1], 10);
      const x = parseInt(match[2], 10);
      const maxX = (1 << z) - 1;

      if (x === maxX || x === 0) {
        try {
          const healedBuffer = await healWeatherTileSeam(blob, x === maxX);
          return { data: healedBuffer };
        } catch (err) {
          // Fallback to original buffer
        }
      }
    }

    const arrayBuffer = await blob.arrayBuffer();
    return { data: arrayBuffer };
  });

  isProtocolRegistered = true;
}

/**
 * Returns formatted UTC timestamp (yyyyMMddHH) for WeatherAPI tile requests
 * @param {Date|number} [dateOrOffset=0] - Either Date object or hourly offset from now
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
 * Generates Slippy Map Tile URL template for WeatherAPI
 * @param {'tmp2m'|'precip'} layerKey
 * @param {number|Date} [dateOrOffset=0]
 */
export function getWeatherApiTileUrl(layerKey = 'tmp2m', dateOrOffset = 0) {
  registerWeatherApiProtocol();
  const timestamp = getWeatherApiTimestamp(dateOrOffset);
  return `weatherapi://weathermaps.weatherapi.com/${layerKey}/tiles/${timestamp}/{z}/{x}/{y}.png`;
}
