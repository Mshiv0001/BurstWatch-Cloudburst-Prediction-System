/**
 * CacheEvents.js
 * Lightweight Pub/Sub event bus for reactive cache telemetry and UI synchronization.
 */

class CacheEvents {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribes a listener callback to an event
   * @param {string} event Event name
   * @param {Function} callback Handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.listeners.delete(event);
      }
    };
  }

  /**
   * Dispatches an event with an optional payload
   * @param {string} event Event name
   * @param {any} payload Data
   */
  emit(event, payload) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach(callback => {
        try {
          callback(payload);
        } catch (err) {
          console.warn(`[CacheEvents] Error in listener for ${event}:`, err);
        }
      });
    }
  }
}

export const cacheEvents = new CacheEvents();
