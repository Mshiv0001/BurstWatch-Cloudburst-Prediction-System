/**
 * terrainElevationCache.js
 * Dedicated Layer Cache for Topographical 30m DEM Elevation & Slope Parameters.
 * 
 * Policy:
 * - Quasi-static data (24-hour TTL).
 * - Prevents repetitive elevation queries for static stations & terrain points.
 */

import { CacheManager } from '../core/CacheManager.js';
import { getSpatialGridKey, CACHE_NAMESPACES } from '../config/storageKeys.js';
import { TTL_SECONDS } from '../config/cacheRules.js';

export const terrainElevationCacheManager = new CacheManager({
  maxMemoryEntries: 500,
  defaultTtlSeconds: TTL_SECONDS.TERRAIN_ELEVATION // 24 Hours
});

export function getCachedTerrainParams(lat, lon) {
  const key = getSpatialGridKey(lat, lon, CACHE_NAMESPACES.TERRAIN);
  const mem = terrainElevationCacheManager.getMemory(key);
  return mem ? mem.data : null;
}

export function setCachedTerrainParams(lat, lon, params) {
  const key = getSpatialGridKey(lat, lon, CACHE_NAMESPACES.TERRAIN);
  return terrainElevationCacheManager.set(key, params, TTL_SECONDS.TERRAIN_ELEVATION);
}
