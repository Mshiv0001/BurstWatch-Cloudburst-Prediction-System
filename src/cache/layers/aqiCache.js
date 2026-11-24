/**
 * aqiCache.js
 * Dedicated Layer Cache for AetherAura™ Live Air Quality (AQI) Telemetry.
 * 
 * Policy:
 * - 30-minute sliding window epoch synchronization.
 * - Atomic replacement of previous dataset upon fresh batch ingestion.
 * - Strict stale eviction from L1 Memory and L2 IndexedDB.
 */

import { CacheManager } from '../core/CacheManager.js';
import { buildCacheKey, CACHE_NAMESPACES } from '../config/storageKeys.js';
import { TTL_SECONDS } from '../config/cacheRules.js';

const AQI_MASTER_KEY = buildCacheKey(CACHE_NAMESPACES.AQI, 'master_batch');

export const aqiCacheManager = new CacheManager({
  maxMemoryEntries: 10,
  defaultTtlSeconds: TTL_SECONDS.AIR_QUALITY // 30 minutes (1800s)
});

/**
 * Synchronously retrieves cached AQI dataset if valid within 30-minute window
 * @returns {{ data: Record<string, any>, timestamp: number, expiresAt: number } | null}
 */
export function getCachedAQI() {
  const mem = aqiCacheManager.getMemory(AQI_MASTER_KEY);
  if (mem && mem.data) return mem;

  // Fallback to synchronous localStorage check for instant cold boot
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(AQI_MASTER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.expiresAt && Date.now() < parsed.expiresAt && parsed.data) {
          // Promote to L1
          aqiCacheManager.memoryStore.set(AQI_MASTER_KEY, parsed.data, TTL_SECONDS.AIR_QUALITY);
          return parsed;
        } else {
          localStorage.removeItem(AQI_MASTER_KEY);
        }
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Atomically stores fresh AQI batch data, removing previous cached payload
 * @param {Record<string, any>} dataMap Map of station IDs to AQI metrics
 */
export async function setCachedAQI(dataMap) {
  const entry = await aqiCacheManager.set(AQI_MASTER_KEY, dataMap, TTL_SECONDS.AIR_QUALITY);

  // Synchronously backup to localStorage for zero-latency initial mount
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(AQI_MASTER_KEY, JSON.stringify(entry));
    }
  } catch (_) {}

  return entry;
}

/**
 * Returns minutes remaining until next scheduled 30-minute synchronization
 * @returns {number} Remaining minutes (0 - 30)
 */
export function getAqiCacheMinutesRemaining() {
  const cached = getCachedAQI();
  if (!cached || !cached.expiresAt) return 0;
  return Math.max(0, Math.round((cached.expiresAt - Date.now()) / 60000));
}

/**
 * Explicitly clears the AQI cache to trigger immediate re-fetch
 */
export async function invalidateAqiCache() {
  await aqiCacheManager.invalidate(AQI_MASTER_KEY);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(AQI_MASTER_KEY);
    }
  } catch (_) {}
}
