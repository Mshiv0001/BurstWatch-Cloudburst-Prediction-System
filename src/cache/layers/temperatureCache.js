/**
 * temperatureCache.js
 * Dedicated Layer Cache for Thermodynamic Temperature Field & Pinpoint Observations.
 * 
 * Policy:
 * - 30-minute standard TTL for ambient temperature & thermodynamic observations.
 * - Spatial key normalized to ~1.1km grid precision.
 * - L1 RAM (0ms synchronous lookup) for 60-120 FPS cursor hover rendering.
 * - L2 Persistent Storage (IndexedDB/LocalStorage) so sampled points survive page reloads.
 * - In-flight promise pooling to prevent duplicate Open-Meteo point queries.
 */

import { CacheManager } from '../core/CacheManager.js';
import { getSpatialGridKey, CACHE_NAMESPACES } from '../config/storageKeys.js';
import { TTL_SECONDS, CAPACITY_LIMITS } from '../config/cacheRules.js';

export const temperatureCacheManager = new CacheManager({
  maxMemoryEntries: CAPACITY_LIMITS.TEMPERATURE_MEMORY_LRU,
  defaultTtlSeconds: TTL_SECONDS.TEMPERATURE_POINT // 30 minutes (1800s)
});

/**
 * Normalizes coordinate key to ~1.1km grid precision
 */
export function getTemperatureKey(lat, lon) {
  return getSpatialGridKey(lat, lon, CACHE_NAMESPACES.TEMPERATURE);
}

/**
 * Synchronous L1 lookup for instant 60-120 FPS cursor hover probing (0ms latency)
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @param {number} ttlMinutes Optional custom TTL in minutes (defaults to 30)
 * @returns {object | null}
 */
export function getCachedPointTemp(lat, lon, ttlMinutes = 30) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;
  const key = getTemperatureKey(lat, lon);
  const mem = temperatureCacheManager.getMemory(key);
  if (mem) {
    const ageMs = Date.now() - mem.timestamp;
    if (ageMs < ttlMinutes * 60 * 1000) {
      return mem.data;
    } else {
      temperatureCacheManager.memoryStore.delete(key);
    }
  }

  // Synchronous localStorage check for instant cold restart availability
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const ageMs = Date.now() - (parsed.timestamp || 0);
        if (ageMs < ttlMinutes * 60 * 1000) {
          // Promote back to L1
          temperatureCacheManager.memoryStore.set(key, parsed.data, ttlMinutes * 60);
          return parsed.data;
        } else {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Atomically stores fresh temperature observation in both L1 and L2
 * @param {number} lat
 * @param {number} lon
 * @param {object} data Temperature observation data
 * @param {number} ttlMinutes Optional custom TTL in minutes (defaults to 30)
 */
export function setCachedPointTemp(lat, lon, data, ttlMinutes = 30) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;
  const key = getTemperatureKey(lat, lon);
  const ttlSeconds = ttlMinutes * 60;
  temperatureCacheManager.set(key, data, ttlSeconds);

  // Synchronous localStorage write for instant cold reload survival
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const entry = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (ttlSeconds * 1000)
      };
      localStorage.setItem(key, JSON.stringify(entry));
    }
  } catch (_) {}
}

/**
 * Fetches temperature data with in-flight deduplication and 30-min atomic caching
 * @param {number} lat
 * @param {number} lon
 * @param {Function} fetcherFn Async function returning fresh observation
 * @param {number} ttlMinutes Optional custom TTL in minutes (defaults to 30)
 */
export async function getOrFetchPointTemp(lat, lon, fetcherFn, ttlMinutes = 30) {
  const key = getTemperatureKey(lat, lon);
  return temperatureCacheManager.getOrFetch(key, fetcherFn, {
    ttlSeconds: ttlMinutes * 60,
    forceRefresh: false
  });
}

/**
 * Invalidates temperature cache for a specific coordinate
 */
export function invalidatePointTemp(lat, lon) {
  const key = getTemperatureKey(lat, lon);
  temperatureCacheManager.invalidate(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  } catch (_) {}
}
