/**
 * cycloneCache.js
 * Dedicated Layer Cache for GDACS / NOAA Global Tropical Cyclone Advisories.
 *
 * Policy:
 * - 30-minute standard TTL (TTL_SECONDS.CYCLONE_ADVISORY).
 * - Multi-tier L1 Memory + L2 Persistent Storage with request deduplication.
 */

import { CacheManager } from '../core/CacheManager.js';
import { buildCacheKey, CACHE_NAMESPACES } from '../config/storageKeys.js';
import { TTL_SECONDS } from '../config/cacheRules.js';

const CYCLONE_MASTER_KEY = buildCacheKey(CACHE_NAMESPACES.CYCLONES, 'active_global');

export const cycloneCacheManager = new CacheManager({
  maxMemoryEntries: 10,
  defaultTtlSeconds: TTL_SECONDS.CYCLONE_ADVISORY
});

/**
 * Synchronously retrieves cached cyclone list from L1 memory if present.
 * @returns {Array<object> | null}
 */
export function getCachedCyclones() {
  const mem = cycloneCacheManager.getMemory(CYCLONE_MASTER_KEY);
  return mem ? mem.data : null;
}

/**
 * Stores fresh cyclone advisory list across L1 + L2 tiers.
 * @param {Array<object>} cyclones
 */
export function setCachedCyclones(cyclones) {
  return cycloneCacheManager.set(CYCLONE_MASTER_KEY, cyclones, TTL_SECONDS.CYCLONE_ADVISORY);
}

/**
 * Retrieves cached cyclones (L1 -> L2) or executes deduplicated network fetch.
 * @param {() => Promise<Array<object>>} fetcher
 * @param {boolean} forceRefresh
 * @returns {Promise<Array<object>>}
 */
export function getOrFetchCyclones(fetcher, forceRefresh = false) {
  return cycloneCacheManager.getOrFetch(
    CYCLONE_MASTER_KEY,
    fetcher,
    TTL_SECONDS.CYCLONE_ADVISORY,
    forceRefresh
  );
}

/**
 * Clears cached cyclone advisories from L1 and L2.
 */
export function invalidateCycloneCache() {
  return cycloneCacheManager.invalidate(CYCLONE_MASTER_KEY);
}

