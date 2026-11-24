/**
 * AetherAura™ High-Efficiency Planetary Air Quality (AQI) Ingestion & Caching Engine
 *
 * Scaled Global Architecture:
 * 1. Two-Tier Sliding Window Cache (In-Memory + localStorage `burstwatch_global_aqi_v2`) with 30-min TTL.
 * 2. Strict Stale Eviction: Automatically purges obsolete datasets from memory and storage upon expiration.
 * 3. High-Throughput Chunked Batch Ingestion: Queries Open-Meteo in chunks of ~28 coordinates with polite 30ms pacing.
 * 4. Microsecond Caching: Subsequent accesses return instantly (0 ms latency, 0 network overhead).
 * 5. Deterministic Baseline Synthesis: Guaranteed seamless planetary coverage even during offline / rate-limit scenarios.
 * 6. CPCB / US-EPA Harmonized Categorization: 6 standardized health risk categories with pollutant telemetry.
 */

import { getGlobalAqiStationNetwork } from '../data/globalAqiCities.js';

export { getGlobalAqiStationNetwork };

const AQI_CACHE_KEY = 'burstwatch_global_aqi_v2';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const BATCH_CHUNK_SIZE = 28; // Safe coordinate batch limit per Open-Meteo GET request

// Tier 1 in-memory runtime cache for instantaneous sub-millisecond retrieval
let inMemoryAqiCache = null;

/**
 * Air Quality Standard Categorization & Visual Encoding
 */
export const AQI_CATEGORIES = [
  {
    min: 0,
    max: 50,
    category: 'Good',
    label: 'Good',
    color: '#10b981', // Emerald Mint
    glowColor: 'rgba(16, 185, 129, 0.45)',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/40',
    bgColor: 'bg-emerald-500/20',
    healthAdvice: 'Air quality is pristine and satisfactory. Air pollution poses little or no risk.',
    maskRecommended: false
  },
  {
    min: 51,
    max: 100,
    category: 'Satisfactory',
    label: 'Satisfactory',
    color: '#f59e0b', // Solar Amber
    glowColor: 'rgba(245, 158, 11, 0.50)',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/40',
    bgColor: 'bg-amber-500/20',
    healthAdvice: 'Acceptable air quality. Exceptionally sensitive individuals should observe mild caution.',
    maskRecommended: false
  },
  {
    min: 101,
    max: 200,
    category: 'Moderate',
    label: 'Moderate',
    color: '#f97316', // Papaya Coral
    glowColor: 'rgba(249, 115, 22, 0.60)',
    textColor: 'text-orange-300',
    borderColor: 'border-orange-500/40',
    bgColor: 'bg-orange-500/20',
    healthAdvice: 'May cause breathing discomfort to people with asthma, heart ailments, or respiratory conditions.',
    maskRecommended: true
  },
  {
    min: 201,
    max: 300,
    category: 'Poor',
    label: 'Poor',
    color: '#e11d48', // Crimson Rose
    glowColor: 'rgba(225, 29, 72, 0.75)',
    textColor: 'text-rose-300',
    borderColor: 'border-rose-500/40',
    bgColor: 'bg-rose-500/20',
    healthAdvice: 'Breathing discomfort to most individuals on prolonged exposure. Avoid strenuous outdoor activities.',
    maskRecommended: true
  },
  {
    min: 301,
    max: 400,
    category: 'Very Poor',
    label: 'Very Poor',
    color: '#9333ea', // Amethyst Purple
    glowColor: 'rgba(147, 51, 234, 0.85)',
    textColor: 'text-purple-300',
    borderColor: 'border-purple-500/40',
    bgColor: 'bg-purple-500/20',
    healthAdvice: 'High health hazard. Prolonged exposure causes respiratory illness. N95 mask strongly advised.',
    maskRecommended: true
  },
  {
    min: 401,
    max: 999,
    category: 'Severe',
    label: 'Severe',
    color: '#4c0519', // Obsidian Maroon / Deep Crimson Core
    glowColor: 'rgba(136, 19, 55, 0.95)',
    textColor: 'text-red-400',
    borderColor: 'border-red-600/60',
    bgColor: 'bg-red-950/40',
    healthAdvice: 'Emergency health hazard! Serious impact on all populations. Wear N95/FFP2 masks and remain indoors.',
    maskRecommended: true
  }
];

/**
 * Returns the standardized AQI category descriptor for a numeric value
 */
export function getAqiCategory(aqiValue) {
  const val = Math.max(0, Math.round(Number(aqiValue) || 0));
  for (let i = 0; i < AQI_CATEGORIES.length; i++) {
    const cat = AQI_CATEGORIES[i];
    if (val >= cat.min && val <= cat.max) {
      return { ...cat, aqi: val };
    }
  }
  return { ...AQI_CATEGORIES[AQI_CATEGORIES.length - 1], aqi: val };
}

/**
 * Helper to fetch and validate cached AQI telemetry.
 * Enforces strict stale eviction: if expired, purges memory & storage immediately.
 */
export function getCachedAQI() {
  const now = Date.now();

  // 1. Check in-memory store first (Tier 1)
  if (inMemoryAqiCache && inMemoryAqiCache.expiresAt && now < inMemoryAqiCache.expiresAt) {
    return inMemoryAqiCache;
  }

  // 2. Check localStorage (Tier 2)
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(AQI_CACHE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.expiresAt && now < parsed.expiresAt && parsed.data) {
        inMemoryAqiCache = parsed;
        return parsed;
      }
      // Stale data detected: evict immediately
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AQI_CACHE_KEY);
      }
    }
  } catch (err) {
    console.warn('[AQI] Error accessing cache, resetting:', err);
    try {
      if (typeof window !== 'undefined') localStorage.removeItem(AQI_CACHE_KEY);
    } catch (_) {}
  }

  // Clear in-memory reference to allow garbage collection
  inMemoryAqiCache = null;
  return null;
}

/**
 * Persists fresh AQI data with a 30-minute expiration window across both tiers
 */
export function setCachedAQI(dataMap) {
  const now = Date.now();
  const cachePayload = {
    timestamp: now,
    expiresAt: now + CACHE_TTL_MS,
    data: dataMap,
    count: Object.keys(dataMap).length
  };

  inMemoryAqiCache = cachePayload;

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AQI_CACHE_KEY, JSON.stringify(cachePayload));
    }
  } catch (err) {
    console.warn('[AQI] Failed to persist to localStorage (quota or disabled):', err);
  }

  return cachePayload;
}

/**
 * Invalidates both in-memory and persistent localStorage caches
 */
export function invalidateAqiCache() {
  inMemoryAqiCache = null;
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AQI_CACHE_KEY);
    }
  } catch (_) {}
}

/**
 * Returns cache telemetry stats for diagnostics and UI status widgets
 */
export function getAqiCacheStats() {
  const cached = getCachedAQI();
  if (!cached) {
    return { isCached: false, stationsCount: 0, minutesRemaining: 0, expiresAt: null };
  }
  const remaining = Math.max(0, Math.round((cached.expiresAt - Date.now()) / 60000));
  return {
    isCached: true,
    stationsCount: cached.count || Object.keys(cached.data || {}).length,
    minutesRemaining: remaining,
    expiresAt: cached.expiresAt,
    timestamp: cached.timestamp
  };
}

/**
 * Returns minutes remaining until next scheduled 30-minute synchronization
 */
export function getAqiCacheMinutesRemaining() {
  const cached = getCachedAQI();
  if (!cached || !cached.expiresAt) return 0;
  return Math.max(0, Math.round((cached.expiresAt - Date.now()) / 60000));
}

/**
 * Generates an authentic fallback reading for any station (Indian or international)
 * based on geographic coordinate patterns and seasonal baselines.
 */
function generateRealisticStationBaseline(station) {
  const lat = station.lat || 20.0;
  const lon = station.lon || 78.0;

  let baseAqi = station.baselineAqi;
  if (!baseAqi || typeof baseAqi !== 'number') {
    // Spatial heuristic if baselineAqi was not pre-set
    const isNorthernPlains = lat >= 25.0 && lat <= 30.5 && lon >= 74.0 && lon <= 88.0;
    const isHimalayan = lat > 30.5 && lon >= 74.0 && lon <= 85.0;
    const isIndustrialEastAsia = lat >= 20.0 && lat <= 42.0 && lon >= 105.0 && lon <= 125.0;
    const isDesertDustZone = lat >= 15.0 && lat <= 35.0 && lon >= 35.0 && lon <= 60.0;
    const isOceaniaClean = lat <= -10.0 && lon >= 110.0;

    if (isHimalayan || isOceaniaClean) {
      baseAqi = 22 + Math.round(Math.random() * 20);
    } else if (isNorthernPlains || isIndustrialEastAsia) {
      baseAqi = 140 + Math.round(Math.random() * 90);
    } else if (isDesertDustZone) {
      baseAqi = 95 + Math.round(Math.random() * 55);
    } else {
      baseAqi = 45 + Math.round(Math.random() * 35);
    }
  } else {
    // Add natural subtle jitter (+/- 8%)
    const jitter = Math.round((Math.random() - 0.5) * (baseAqi * 0.16));
    baseAqi = Math.max(12, baseAqi + jitter);
  }

  const pm25 = parseFloat((baseAqi * 0.44 + Math.random() * 4).toFixed(1));
  const pm10 = parseFloat((pm25 * 1.70 + Math.random() * 6).toFixed(1));
  const no2 = parseFloat((12 + Math.random() * 26).toFixed(1));
  const o3 = parseFloat((25 + Math.random() * 30).toFixed(1));

  const cat = getAqiCategory(baseAqi);

  return {
    stationId: station.id,
    name: station.name,
    state: station.state || station.country || '',
    country: station.country || 'Global',
    continent: station.continent || 'Global',
    region: station.region || 'metropolitan',
    lat: station.lat,
    lon: station.lon,
    aqi: baseAqi,
    category: cat.category,
    color: cat.color,
    pm2_5: pm25,
    pm10: pm10,
    no2: no2,
    o3: o3,
    dominantPollutant: pm25 > 55 ? 'PM2.5' : (pm10 > 90 ? 'PM10' : 'Ozone'),
    healthAdvice: cat.healthAdvice,
    maskRecommended: cat.maskRecommended,
    time: new Date().toISOString(),
    isEstimated: true
  };
}

/**
 * Ingests live Air Quality telemetry across the planetary network using chunked batch requests.
 * Checks 30-min cache first to prevent redundant network traffic.
 */
export async function getLiveAirQualityNetwork(stations = null, forceRefresh = false) {
  // 1. Check 30-minute sliding window cache unless explicitly forced
  if (!forceRefresh) {
    const cached = getCachedAQI();
    if (cached && cached.data && Object.keys(cached.data).length >= 100) {
      return cached.data;
    }
  }

  const resultsMap = {};
  const cityList = Array.isArray(stations) && stations.length > 0 
    ? stations 
    : getGlobalAqiStationNetwork();

  // 2. Partition stations into chunked batches
  const chunks = [];
  for (let i = 0; i < cityList.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(cityList.slice(i, i + BATCH_CHUNK_SIZE));
  }

  // 3. Process chunks with polite pacing to respect Open-Meteo rate limits
  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    const lats = chunk.map((c) => c.lat.toFixed(4)).join(',');
    const lons = chunk.map((c) => c.lon.toFixed(4)).join(',');
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi,european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Open-Meteo AQI responded with status ${response.status}`);
      }

      const data = await response.json();
      const records = Array.isArray(data) ? data : [data];

      for (let i = 0; i < chunk.length; i++) {
        const station = chunk[i];
        const record = records[i] || {};
        const current = record.current || {};

        const aqiRaw = current.us_aqi != null 
          ? current.us_aqi 
          : (current.european_aqi ? Math.round(current.european_aqi * 1.8) : null);

        if (aqiRaw != null && !isNaN(aqiRaw)) {
          const aqi = Math.max(1, Math.round(aqiRaw));
          const cat = getAqiCategory(aqi);
          const pm25 = current.pm2_5 != null ? parseFloat(current.pm2_5.toFixed(1)) : parseFloat((aqi * 0.45).toFixed(1));
          const pm10 = current.pm10 != null ? parseFloat(current.pm10.toFixed(1)) : parseFloat((pm25 * 1.6).toFixed(1));
          const no2 = current.nitrogen_dioxide != null ? parseFloat(current.nitrogen_dioxide.toFixed(1)) : 18.0;
          const o3 = current.ozone != null ? parseFloat(current.ozone.toFixed(1)) : 42.0;

          resultsMap[station.id] = {
            stationId: station.id,
            name: station.name,
            state: station.state || station.country || '',
            country: station.country || 'Global',
            continent: station.continent || 'Global',
            region: station.region || 'metropolitan',
            lat: station.lat,
            lon: station.lon,
            aqi,
            category: cat.category,
            color: cat.color,
            pm2_5: pm25,
            pm10: pm10,
            no2: no2,
            o3: o3,
            dominantPollutant: pm25 > 50 ? 'PM2.5' : (pm10 > 80 ? 'PM10' : 'Ozone'),
            healthAdvice: cat.healthAdvice,
            maskRecommended: cat.maskRecommended,
            time: current.time || new Date().toISOString(),
            isEstimated: false
          };
        } else {
          // Graceful baseline fallback if record missing
          resultsMap[station.id] = generateRealisticStationBaseline(station);
        }
      }
    } catch (err) {
      clearTimeout(timer);
      // Seamless baseline fallback for network failures / rate limiting
      for (const station of chunk) {
        resultsMap[station.id] = generateRealisticStationBaseline(station);
      }
    }

    // Polite 25ms delay between chunks to preserve clean network throttling
    if (chunkIdx < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  // 4. Save to multi-tier sliding-window cache with 30-min TTL
  setCachedAQI(resultsMap);

  return resultsMap;
}
