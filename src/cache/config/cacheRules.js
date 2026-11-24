/**
 * cacheRules.js
 * Declarative TTL policies, capacity bounds, and adaptive power profiles.
 * Strict standard: 30 minutes for low-churn atmospheric telemetry (>= 30 min).
 */

export const TTL_SECONDS = {
  // 30 Minutes standard for slow-moving atmospheric & telemetry data
  LOW_CHURN_DEFAULT: 30 * 60,         // 1800 seconds (30 mins)
  AIR_QUALITY: 30 * 60,                // 1800 seconds (30 mins)
  SYNOPTIC_WEATHER: 30 * 60,           // 1800 seconds (30 mins)
  TEMPERATURE_POINT: 30 * 60,          // 1800 seconds (30 mins - thermodynamic observations)
  ML_PREDICTION_GRID: 30 * 60,         // 1800 seconds (30 mins)
  CYCLONE_ADVISORY: 30 * 60,           // 1800 seconds (30 mins - NOAA/GDACS updates)
  
  // Quasi-static topographic terrain
  TERRAIN_ELEVATION: 24 * 60 * 60,     // 24 Hours (Static DEM slope/aspect)

  // Sub-30m metadata exceptions
  RADAR_FRAME_METADATA: 10 * 60        // 10 Minutes (RainViewer scan interval)
};

export const CAPACITY_LIMITS = {
  DEFAULT_MEMORY_LRU: 250,             // Max active objects held in V8 heap
  ML_GRID_MEMORY_LRU: 350,             // Max spatial coordinates in ML cache
  WEATHER_MEMORY_LRU: 300,             // Max spatial coordinates in weather cache
  TEMPERATURE_MEMORY_LRU: 1000,        // Max high-resolution spatial points in temp cache
  RADAR_TILES_LRU: 100                 // Max tile metadata objects
};

/**
 * Checks if the client device is in a low-power state (Battery < 20% and discharging)
 * In low-power state, caching TTL can be dynamically lengthened to preserve remaining power.
 */
export async function getBatteryThrottlingMultiplier() {
  if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
    try {
      const battery = await navigator.getBattery();
      if (!battery.charging && battery.level < 0.20) {
        // Battery saving mode: stretch TTL by 50% (30m -> 45m) to avoid cellular wakeups
        return 1.5;
      }
    } catch (_) {
      // Battery Status API blocked or unsupported
    }
  }
  return 1.0;
}
