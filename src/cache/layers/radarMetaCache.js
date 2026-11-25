/**
 * radarMetaCache.js
 * Dedicated Layer Cache for RainViewer Doppler Radar frame loops & metadata.
 */

import { CacheManager } from '../core/CacheManager.js';
import { buildCacheKey, CACHE_NAMESPACES } from '../config/storageKeys.js';
import { TTL_SECONDS, CAPACITY_LIMITS } from '../config/cacheRules.js';

const RADAR_LOOP_KEY = buildCacheKey(CACHE_NAMESPACES.RADAR_META, 'active_loop');

export const radarMetaCacheManager = new CacheManager({
  maxMemoryEntries: CAPACITY_LIMITS.RADAR_TILES_LRU,
  defaultTtlSeconds: TTL_SECONDS.RADAR_FRAME_METADATA // 10 minutes
});

export function getCachedRadarMetadata() {
  const mem = radarMetaCacheManager.getMemory(RADAR_LOOP_KEY);
  return mem ? mem.data : null;
}

export function setCachedRadarMetadata(meta) {
  return radarMetaCacheManager.set(RADAR_LOOP_KEY, meta, TTL_SECONDS.RADAR_FRAME_METADATA);
}

export function getOrFetchRadarMetadata(fetcher, forceRefresh = false) {
  return radarMetaCacheManager.getOrFetch(
    RADAR_LOOP_KEY,
    fetcher,
    TTL_SECONDS.RADAR_FRAME_METADATA,
    forceRefresh
  );
}

export function invalidateRadarMetadataCache() {
  return radarMetaCacheManager.invalidate(RADAR_LOOP_KEY);
}
