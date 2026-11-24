/**
 * RequestDeduplicator.js
 * In-Flight Promise Pooling Engine.
 * 
 * Prevents Cache Stampede & Thundering Herd:
 * If multiple UI components request the same expired or missing key concurrently,
 * they share a single in-flight network Promise rather than firing redundant requests.
 */

export class RequestDeduplicator {
  constructor() {
    this.inFlight = new Map();
  }

  /**
   * Executes or joins an in-flight async task
   * @param {string} key Unique request identifier
   * @param {Function} taskFn Function returning a Promise
   * @returns {Promise<any>}
   */
  async dedupe(key, taskFn) {
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = (async () => {
      try {
        return await taskFn();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Checks if a key is currently in-flight
   * @param {string} key
   */
  has(key) {
    return this.inFlight.has(key);
  }

  /**
   * Active in-flight count
   */
  get size() {
    return this.inFlight.size;
  }
}
