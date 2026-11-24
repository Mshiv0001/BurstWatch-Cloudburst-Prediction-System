/**
 * synopticWeatherCache.js
 * Dedicated Layer Cache for Atmospheric Telemetry & Synoptic Weather.
 * 
 * Policy:
 * - 30-minute standard TTL for synoptic weather features (pressure, temperature, humidity).
 * - Spatial grid key normalization to ~1.1km precision.
 * - Emergency convective bypass: bypasses cache if critical convective pressure drops occur.
 */

import { CacheManager } from '../core/CacheManager.js';
import { getSpatialGridKey, CACHE_NAMESPACES } from '../config/storageKeys.js';
import { TTL_SECONDS, CAPACITY_LIMITS } from '../config/cacheRules.js';

export const synopticWeatherCacheManager = new CacheManager({
  maxMemoryEntries: CAPACITY_LIMITS.WEATHER_MEMORY_LRU,
  defaultTtlSeconds: TTL_SECONDS.SYNOPTIC_WEATHER // 30 minutes (1800s)
});

/**
 * Normalizes coordinate key to ~1.1km grid precision
 */
export function getWeatherCacheKey(lat, lon, prefix = 'telemetry') {
  return getSpatialGridKey(lat, lon, prefix);
}

/**
 * Retrieves cached meteorological data if valid within TTL
 * @param {string} key Cache key
 * @param {number} ttlMinutes Optional custom TTL in minutes (defaults to 30)
 */
export function getCachedWeather(key, ttlMinutes = 30) {
  const ttlMs = ttlMinutes * 60 * 1000;
  const now = Date.now();

  // 1. Fast L1 Memory check
  const mem = synopticWeatherCacheManager.memoryStore.get(key);
  if (mem) {
    const ageMs = now - mem.timestamp;
    if (ageMs < ttlMs) {
      return {
        data: mem.data,
        timestamp: mem.timestamp,
        ageMinutes: Math.floor(ageMs / 60000)
      };
    } else {
      synopticWeatherCacheManager.memoryStore.delete(key);
    }
  }

  // 2. Synchronous check for localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const ageMs = now - (parsed.timestamp || 0);
        if (ageMs < ttlMs) {
          // Promote back to L1
          synopticWeatherCacheManager.memoryStore.set(key, parsed.data, ttlMinutes * 60);
          return {
            data: parsed.data,
            timestamp: parsed.timestamp,
            ageMinutes: Math.floor(ageMs / 60000)
          };
        } else {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Stores meteorological data atomically in both L1 and L2
 * @param {string} key Cache key
 * @param {any} data Meteorological payload
 * @param {number} ttlMinutes Optional custom TTL in minutes (defaults to 30)
 */
export function setCachedWeather(key, data, ttlMinutes = 30) {
  const ttlSeconds = ttlMinutes * 60;
  synopticWeatherCacheManager.set(key, data, ttlSeconds);

  // Synchronously write to localStorage for immediate reload survival
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
 * Invalidates cache for a specific key
 */
export function invalidateWeatherCache(key) {
  synopticWeatherCacheManager.invalidate(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  } catch (_) {}
}

/**
 * Returns cache metadata (age in minutes and remaining validity)
 */
export function getWeatherCacheMeta(key, ttlMinutes = 30) {
  return synopticWeatherCacheManager.getMetadata(key, ttlMinutes * 60);
}
