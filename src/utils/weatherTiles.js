/**
 * WeatherAPI.com Global Slippy Map Tile Services & Layer Registry
 *
 * Provides pre-rendered, seamless global raster tiles for:
 * - 2m Air Temperature ('tmp2m')
 * - Precipitation / Rain Radar ('precip')
 * - Wind Speed ('wind')
 * - Sea-Level Atmospheric Pressure ('pressure')
 *
 * Endpoint Specification:
 * https://weathermaps.weatherapi.com/{layer}/tiles/{yyyyMMddHH}/{z}/{x}/{y}.png
 * - Free, no API key required
 * - Available for 1-hour intervals across past, current, and +3 day forecast
 * - Maximum native zoom level is 6 (MapLibre overscales smoothly beyond zoom 6)
 */

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
    unit: 'mm/h',
    description: 'Global precipitation rate and radar reflectivity from WeatherAPI'
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
    description: 'Global near-surface wind speed velocity fields from WeatherAPI'
  },
  pressure: {
    id: 'pressure',
    layerKey: 'pressure',
    sourceId: 'weatherapi-pressure-source',
    layerId: 'weatherapi-pressure-layer',
    label: 'Pressure',
    shortLabel: 'Pressure',
    icon: 'Compass',
    type: 'raster',
    opacity: 0.62,
    unit: 'hPa',
    description: 'Global sea-level atmospheric pressure isobars from WeatherAPI'
  }
};

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
 * @param {'tmp2m'|'precip'|'wind'|'pressure'} layerKey
 * @param {number|Date} [dateOrOffset=0]
 */
export function getWeatherApiTileUrl(layerKey = 'tmp2m', dateOrOffset = 0) {
  const timestamp = getWeatherApiTimestamp(dateOrOffset);
  return `https://weathermaps.weatherapi.com/${layerKey}/tiles/${timestamp}/{z}/{x}/{y}.png`;
}
