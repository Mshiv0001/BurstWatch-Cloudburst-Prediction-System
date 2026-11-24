/**
 * meteoCacheService.js
 * High-Efficiency Telemetry Cache Bridge powered by src/cache/
 * 
 * Directs all atmospheric telemetry caching through the central Enterprise Caching System:
 * - Tier 1: Fast In-Memory Map (0ms synchronous retrieval during active session)
 * - Tier 2: Persistent Storage (survives page reloads & cold starts)
 * - 30-Minute Standard TTL for low-churn atmospheric data
 * - Prevents redundant network calls, API rate exhaustion & background battery drain
 */

import {
  getWeatherCacheKey,
  getCachedWeather,
  setCachedWeather,
  invalidateWeatherCache,
  getWeatherCacheMeta
} from '../cache/index.js';

export const DEFAULT_TTL_MINUTES = 30; // 30-minute standard for low-churn telemetry

/**
 * Normalizes coordinate key to ~1.1km grid precision
 */
export function getMeteoCacheKey(lat, lon, prefix = 'telemetry') {
  return getWeatherCacheKey(lat, lon, prefix);
}

/**
 * Retrieves cached meteorological data if still valid within TTL
 */
export function getCachedMeteo(key, ttlMinutes = DEFAULT_TTL_MINUTES) {
  return getCachedWeather(key, ttlMinutes);
}

/**
 * Stores meteorological data in both L1 and L2 caches
 */
export function setCachedMeteo(key, data, ttlMinutes = DEFAULT_TTL_MINUTES) {
  return setCachedWeather(key, data, ttlMinutes);
}

/**
 * Invalidates cache for a specific key (force refresh)
 */
export function invalidateMeteoCache(key) {
  return invalidateWeatherCache(key);
}

/**
 * Returns cache metadata (age in minutes and remaining validity)
 */
export function getMeteoCacheMeta(key, ttlMinutes = DEFAULT_TTL_MINUTES) {
  return getWeatherCacheMeta(key, ttlMinutes);
}
