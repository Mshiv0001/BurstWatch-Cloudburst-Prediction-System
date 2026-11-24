/**
 * PersistentStore.js
 * Tier 2: Asynchronous Persistent Storage with IndexedDB & LocalStorage Fallback.
 * 
 * Provides:
 * - Asynchronous, non-blocking disk persistence surviving page reloads & cold starts.
 * - IndexedDB primary storage (large quota, zero main-thread UI stutter).
 * - Automatic LocalStorage fallback if IndexedDB is disabled, blocked, or unavailable.
 */

const DB_NAME = 'burstwatch_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'telemetry_cache';

export class PersistentStore {
  constructor() {
    this.dbPromise = null;
    this.isIdbAvailable = typeof window !== 'undefined' && 'indexedDB' in window;
    if (this.isIdbAvailable) {
      this.initIndexedDb();
    }
  }

  /**
   * Initializes IndexedDB connection
   */
  initIndexedDb() {
    if (!this.isIdbAvailable) return Promise.resolve(null);
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };

        request.onerror = () => {
          console.warn('[PersistentStore] IndexedDB open error, falling back to localStorage');
          this.isIdbAvailable = false;
          resolve(null);
        };
      } catch (err) {
        console.warn('[PersistentStore] IndexedDB exception, falling back to localStorage:', err);
        this.isIdbAvailable = false;
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Retrieves entry from persistent storage
   * @param {string} key
   * @returns {Promise<{ data: any, timestamp: number, expiresAt: number } | null>}
   */
  async get(key) {
    // 1. Try IndexedDB
    if (this.isIdbAvailable) {
      try {
        const db = await this.initIndexedDb();
        if (db) {
          const entry = await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.payload : null);
            req.onerror = () => resolve(null);
          });

          if (entry) {
            // Check expiry
            if (entry.expiresAt && Date.now() >= entry.expiresAt) {
              await this.delete(key);
              return null;
            }
            return entry;
          }
        }
      } catch (_) {
        // Fallback to localStorage
      }
    }

    // 2. Fallback to LocalStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const entry = JSON.parse(raw);
          if (entry.expiresAt && Date.now() >= entry.expiresAt) {
            localStorage.removeItem(key);
            return null;
          }
          return entry;
        }
      }
    } catch (_) {}

    return null;
  }

  /**
   * Persists entry to storage
   * @param {string} key
   * @param {object} entry Payload with { data, timestamp, expiresAt }
   */
  async set(key, entry) {
    let idbSucceeded = false;

    // 1. Try IndexedDB
    if (this.isIdbAvailable) {
      try {
        const db = await this.initIndexedDb();
        if (db) {
          await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put({ key, payload: entry });
            req.onsuccess = () => { idbSucceeded = true; resolve(); };
            req.onerror = () => reject(req.error);
          });
        }
      } catch (_) {
        // Fallback to localStorage
      }
    }

    // 2. Write to LocalStorage (as primary if no IDB, or secondary backup)
    if (!idbSucceeded) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(key, JSON.stringify(entry));
        }
      } catch (_) {
        // LocalStorage quota exceeded or disabled
      }
    }
  }

  /**
   * Evicts entry from persistent storage
   * @param {string} key
   */
  async delete(key) {
    if (this.isIdbAvailable) {
      try {
        const db = await this.initIndexedDb();
        if (db) {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(key);
        }
      } catch (_) {}
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (_) {}
  }

  /**
   * Clears all entries from storage
   */
  async clear() {
    if (this.isIdbAvailable) {
      try {
        const db = await this.initIndexedDb();
        if (db) {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
        }
      } catch (_) {}
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Remove only burstwatch cache keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('burstwatch_')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      }
    } catch (_) {}
  }
}
