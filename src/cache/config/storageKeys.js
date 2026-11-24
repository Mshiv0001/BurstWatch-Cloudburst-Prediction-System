/**
 * storageKeys.js
 * Centralized namespaced storage key registry for BurstWatch caching system.
 * Prevents key collision and enables atomic pattern-based invalidation.
 */

export const STORAGE_PREFIX = 'burstwatch_cache_v2:';

export const CACHE_NAMESPACES = {
  AQI: 'aqi',
  SYNOPTIC_WEATHER: 'synoptic',
  ML_PREDICTIONS: 'ml_grid',
  RADAR_META: 'radar_meta',
  CYCLONES: 'cyclones',
  TERRAIN: 'terrain',
  TEMPERATURE: 'temperature'
};

/**
 * Builds a standardized namespaced cache key
 * @param {string} namespace One of CACHE_NAMESPACES
 * @param {string} identifier Unique identifier or coordinate string
 * @returns {string} Fully qualified namespaced key
 */
export function buildCacheKey(namespace, identifier = 'default') {
  return `${STORAGE_PREFIX}${namespace}:${identifier}`;
}

/**
 * Converts geographic coordinates to a standardized ~1.1km grid spatial key
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @param {string} prefix Optional namespace prefix
 * @returns {string} Normalized spatial key
 */
export function getSpatialGridKey(lat, lon, prefix = CACHE_NAMESPACES.SYNOPTIC_WEATHER) {
  if (lat == null || lon == null) return buildCacheKey(prefix, 'default');
  const latNorm = Number(lat).toFixed(2);
  const lonNorm = Number(lon).toFixed(2);
  return buildCacheKey(prefix, `${latNorm}_${lonNorm}`);
}
