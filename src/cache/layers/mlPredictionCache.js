/**
 * mlPredictionCache.js
 * Dedicated Layer Cache for Dual-Engine ML Predictions (LightGBM + XGBoost).
 * 
 * Policy:
 * - 30-minute spatial grid TTL (normalized to ~1.1km grid).
 * - Bounded LRU capacity to prevent memory bloat during broad map hovering.
 * - In-flight promise pooling to prevent duplicate prediction calls.
 */

import { CacheManager } from '../core/CacheManager.js';
import { getSpatialGridKey, CACHE_NAMESPACES } from '../config/storageKeys.js';
import { TTL_SECONDS, CAPACITY_LIMITS } from '../config/cacheRules.js';

export const mlPredictionCacheManager = new CacheManager({
  maxMemoryEntries: CAPACITY_LIMITS.ML_GRID_MEMORY_LRU,
  defaultTtlSeconds: TTL_SECONDS.ML_PREDICTION_GRID // 30 minutes (1800s)
});

/**
 * Returns standardized spatial key for ML prediction coordinates
 */
export function getMLCoordKey(lat, lon) {
  return getSpatialGridKey(lat, lon, CACHE_NAMESPACES.ML_PREDICTIONS);
}

/**
 * Synchronous L1 lookup for instant coordinate hover probing (0ms latency)
 */
export function getCachedMLPrediction(lat, lon, ttlMinutes = 30) {
  const key = getMLCoordKey(lat, lon);
  const mem = mlPredictionCacheManager.getMemory(key);
  if (mem) {
    const ageMs = Date.now() - mem.timestamp;
    if (ageMs < ttlMinutes * 60 * 1000) {
      return mem.data;
    } else {
      mlPredictionCacheManager.memoryStore.delete(key);
    }
  }
  return null;
}

/**
 * Atomically stores ML prediction result in cache
 */
export function setCachedMLPrediction(lat, lon, data, ttlMinutes = 30) {
  const key = getMLCoordKey(lat, lon);
  return mlPredictionCacheManager.set(key, data, ttlMinutes * 60);
}

/**
 * Executes a prediction fetch with in-flight deduplication and 30-min caching
 */
export async function getOrFetchMLPrediction(lat, lon, fetcherFn, ttlMinutes = 30) {
  const key = getMLCoordKey(lat, lon);
  return mlPredictionCacheManager.getOrFetch(key, fetcherFn, {
    ttlSeconds: ttlMinutes * 60,
    forceRefresh: false
  });
}
