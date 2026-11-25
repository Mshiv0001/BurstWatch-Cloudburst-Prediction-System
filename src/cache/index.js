/**
 * src/cache/index.js
 * Unified Enterprise Caching System Facade for BurstWatch.
 * 
 * Provides:
 * 1. Single entry point for clean navigation across all services & UI components.
 * 2. Multi-tier L1 RAM (0ms) + L2 Persistent Storage with atomic replacement.
 * 3. 30-minute standard TTL for slow-churn atmospheric telemetry to reduce API & battery drain.
 * 4. In-flight request deduplication to prevent thundering herd / cache stampedes.
 */

// Core Engine
export { CacheManager } from './core/CacheManager.js';
export { MemoryStore } from './core/MemoryStore.js';
export { PersistentStore } from './core/PersistentStore.js';
export { RequestDeduplicator } from './core/RequestDeduplicator.js';
export { cacheEvents } from './core/CacheEvents.js';

// Configuration & Storage Keys
export {
  STORAGE_PREFIX,
  CACHE_NAMESPACES,
  buildCacheKey,
  getSpatialGridKey
} from './config/storageKeys.js';

export {
  TTL_SECONDS,
  CAPACITY_LIMITS,
  getBatteryThrottlingMultiplier
} from './config/cacheRules.js';

// Layer Caches
export {
  aqiCacheManager,
  getCachedAQI,
  setCachedAQI,
  getAqiCacheMinutesRemaining,
  invalidateAqiCache
} from './layers/aqiCache.js';

export {
  synopticWeatherCacheManager,
  getWeatherCacheKey,
  getCachedWeather,
  setCachedWeather,
  invalidateWeatherCache,
  getWeatherCacheMeta
} from './layers/synopticWeatherCache.js';

export {
  mlPredictionCacheManager,
  getMLCoordKey,
  getCachedMLPrediction,
  setCachedMLPrediction,
  getOrFetchMLPrediction
} from './layers/mlPredictionCache.js';

export {
  radarMetaCacheManager,
  getCachedRadarMetadata,
  setCachedRadarMetadata,
  getOrFetchRadarMetadata,
  invalidateRadarMetadataCache
} from './layers/radarMetaCache.js';

export {
  cycloneCacheManager,
  getCachedCyclones,
  setCachedCyclones,
  getOrFetchCyclones,
  invalidateCycloneCache
} from './layers/cycloneCache.js';

export {
  terrainElevationCacheManager,
  getCachedTerrainParams,
  setCachedTerrainParams
} from './layers/terrainElevationCache.js';

export {
  temperatureCacheManager,
  getTemperatureKey,
  getCachedPointTemp,
  setCachedPointTemp,
  getOrFetchPointTemp,
  invalidatePointTemp
} from './layers/temperatureCache.js';
