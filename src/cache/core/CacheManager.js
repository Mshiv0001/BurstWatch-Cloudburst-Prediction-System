/**
 * CacheManager.js
 * Multi-Tier Universal Caching Orchestrator.
 * 
 * Guarantees:
 * 1. Tier 1 (L1): Fast In-Memory LRU (0ms synchronous retrieval).
 * 2. Tier 2 (L2): Persistent IndexedDB/LocalStorage (survives page reloads & cold starts).
 * 3. Atomic Replacement: Overwrites prior cached data immediately upon fresh arrival.
 * 4. Strict Stale Eviction: Expired data is purged from memory and disk.
 * 5. Request Deduplication: In-flight promise pooling prevents thundering herd.
 */

import { MemoryStore } from './MemoryStore.js';
import { PersistentStore } from './PersistentStore.js';
import { RequestDeduplicator } from './RequestDeduplicator.js';
import { cacheEvents } from './CacheEvents.js';
import { TTL_SECONDS, CAPACITY_LIMITS } from '../config/cacheRules.js';

export class CacheManager {
  /**
   * @param {object} options
   * @param {number} options.maxMemoryEntries Max L1 items
   * @param {number} options.defaultTtlSeconds Default TTL in seconds (default 30 min)
   */
  constructor({
    maxMemoryEntries = CAPACITY_LIMITS.DEFAULT_MEMORY_LRU,
    defaultTtlSeconds = TTL_SECONDS.LOW_CHURN_DEFAULT
  } = {}) {
    this.memoryStore = new MemoryStore(maxMemoryEntries);
    this.persistentStore = new PersistentStore();
    this.deduplicator = new RequestDeduplicator();
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  /**
   * Synchronous L1 memory check (fastest, 0ms)
   * @param {string} key
   * @returns {{ data: any, timestamp: number, expiresAt: number } | null}
   */
  getMemory(key) {
    return this.memoryStore.get(key);
  }

  /**
   * Multi-tier retrieval (L1 -> L2 -> null)
   * Promotes valid L2 data to L1.
   * Evicts expired records immediately.
   * @param {string} key
   * @param {number} ttlSeconds Custom TTL override
   * @returns {Promise<{ data: any, timestamp: number, ageMinutes: number } | null>}
   */
  async get(key, ttlSeconds = this.defaultTtlSeconds) {
    const now = Date.now();
    const ttlMs = ttlSeconds * 1000;

    // 1. Check L1 Memory (0ms)
    const memEntry = this.memoryStore.get(key);
    if (memEntry) {
      const ageMs = now - memEntry.timestamp;
      if (ageMs < ttlMs) {
        cacheEvents.emit('cache:hit', { tier: 'L1', key });
        return {
          data: memEntry.data,
          timestamp: memEntry.timestamp,
          ageMinutes: Math.floor(ageMs / 60000)
        };
      }
      // Expired: evict from L1
      this.memoryStore.delete(key);
    }

    // 2. Check L2 Persistent Storage
    try {
      const persisted = await this.persistentStore.get(key);
      if (persisted) {
        const ageMs = now - (persisted.timestamp || 0);
        if (ageMs < ttlMs) {
          // Promote back to L1 Memory
          this.memoryStore.set(key, persisted.data, ttlSeconds);
          cacheEvents.emit('cache:hit', { tier: 'L2', key });
          return {
            data: persisted.data,
            timestamp: persisted.timestamp,
            ageMinutes: Math.floor(ageMs / 60000)
          };
        }
        // Stale eviction
        await this.persistentStore.delete(key);
      }
    } catch (_) {}

    cacheEvents.emit('cache:miss', { key });
    return null;
  }

  /**
   * Atomically stores data in both L1 Memory and L2 Persistent Storage,
   * replacing previous cached data immediately and broadcasting an update event.
   * @param {string} key
   * @param {any} data
   * @param {number} ttlSeconds
   */
  async set(key, data, ttlSeconds = this.defaultTtlSeconds) {
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);
    const entry = { data, timestamp: now, expiresAt };

    // 1. Atomically overwrite L1 Memory
    this.memoryStore.set(key, data, ttlSeconds);

    // 2. Atomically overwrite L2 Persistent Store
    await this.persistentStore.set(key, entry);

    cacheEvents.emit('cache:updated', { key, timestamp: now, expiresAt });
    return entry;
  }

  /**
   * High-Level Read-Through & Write-Through Ingestion Pattern
   * Checks cache first; if miss, fetches fresh data through in-flight deduplication
   * and atomically replaces cache.
   * 
   * @param {string} key Cache key
   * @param {Function} fetcherFn Async function returning fresh data
   * @param {object} options
   * @param {number} options.ttlSeconds Time-to-live in seconds
   * @param {boolean} options.forceRefresh Bypass cache and force network fetch
   */
  async getOrFetch(key, fetcherFn, {
    ttlSeconds = this.defaultTtlSeconds,
    forceRefresh = false
  } = {}) {
    if (!forceRefresh) {
      const cached = await this.get(key, ttlSeconds);
      if (cached) return cached.data;
    } else {
      await this.invalidate(key);
    }

    // Deduplicate in-flight network queries
    return this.deduplicator.dedupe(key, async () => {
      const freshData = await fetcherFn();
      if (freshData != null) {
        await this.set(key, freshData, ttlSeconds);
      }
      return freshData;
    });
  }

  /**
   * Explicitly evicts a key from all tiers (L1 and L2)
   * @param {string} key
   */
  async invalidate(key) {
    this.memoryStore.delete(key);
    await this.persistentStore.delete(key);
    cacheEvents.emit('cache:invalidated', { key });
  }

  /**
   * Returns cache metadata (age and remaining validity)
   * @param {string} key
   * @param {number} ttlSeconds
   */
  getMetadata(key, ttlSeconds = this.defaultTtlSeconds) {
    const now = Date.now();
    let timestamp = null;

    const mem = this.memoryStore.get(key);
    if (mem) {
      timestamp = mem.timestamp;
    }

    const ttlMs = ttlSeconds * 1000;
    if (!timestamp) {
      return {
        isCached: false,
        ageMinutes: 0,
        nextUpdateMinutes: Math.ceil(ttlSeconds / 60),
        timestamp: null
      };
    }

    const ageMs = Math.max(0, now - timestamp);
    const ageMinutes = Math.floor(ageMs / 60000);
    const remainingMs = Math.max(0, ttlMs - ageMs);
    const nextUpdateMinutes = Math.ceil(remainingMs / 60000);

    return {
      isCached: true,
      ageMinutes,
      nextUpdateMinutes: Math.max(1, nextUpdateMinutes),
      timestamp
    };
  }

  /**
   * Clears all cache entries
   */
  async clear() {
    this.memoryStore.clear();
    await this.persistentStore.clear();
    cacheEvents.emit('cache:cleared', {});
  }
}
