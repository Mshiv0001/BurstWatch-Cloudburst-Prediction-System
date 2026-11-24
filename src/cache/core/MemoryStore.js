/**
 * MemoryStore.js
 * Tier 1: Ultra-fast In-Memory LRU (Least Recently Used) Store.
 * 
 * Provides:
 * - 0ms synchronous read & write directly in the V8 JavaScript Heap.
 * - O(1) LRU eviction to prevent memory bloat and garbage collection pauses.
 * - Strict expiration validation against entry `expiresAt`.
 */

export class MemoryStore {
  /**
   * @param {number} maxCapacity Maximum number of entries before LRU eviction
   */
  constructor(maxCapacity = 250) {
    this.maxCapacity = Math.max(1, maxCapacity);
    this.store = new Map();
  }

  /**
   * Retrieves an entry if present and not expired
   * Refreshes LRU position on access
   * @param {string} key
   * @returns {{ data: any, timestamp: number, expiresAt: number } | null}
   */
  get(key) {
    if (!this.store.has(key)) return null;

    const entry = this.store.get(key);
    const now = Date.now();

    // Stale check
    if (entry.expiresAt && now >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Refresh LRU order: delete & set places key at the end of Map iterator
    this.store.delete(key);
    this.store.set(key, entry);

    return entry;
  }

  /**
   * Stores an entry in memory with LRU bounds enforcement
   * @param {string} key
   * @param {any} data
   * @param {number} ttlSeconds Time-to-live in seconds
   * @returns {{ data: any, timestamp: number, expiresAt: number }}
   */
  set(key, data, ttlSeconds = 1800) {
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);
    const entry = { data, timestamp: now, expiresAt };

    // Evict existing entry if present to update position
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxCapacity) {
      // Evict least recently used (first key in Map iterator)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, entry);
    return entry;
  }

  /**
   * Checks existence without modifying LRU order
   * @param {string} key
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Explicitly evicts an entry
   * @param {string} key
   */
  delete(key) {
    return this.store.delete(key);
  }

  /**
   * Clears all memory entries
   */
  clear() {
    this.store.clear();
  }

  /**
   * Returns current count of valid entries
   */
  get size() {
    return this.store.size;
  }
}
