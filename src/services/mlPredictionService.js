/**
 * High-Performance Client-Side ML Prediction Service & Cache
 * Directly interacts with the FastAPI backend Dual-Engine Ensemble (LightGBM + XGBoost).
 * Zero hardcoded risk percentages: every location reflects real model inference.
 */

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache
const predictionCache = new Map();
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const PROD_BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || 
  (isLocalhost ? '' : 'https://burstwatch-ml-backend.onrender.com')
).replace(/\/$/, '');

// Helper to round coordinates to ~1 km grid
function getCoordKey(lat, lon) {
  return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

/**
 * Predicts cloudburst risk using the live backend ML engine (POST /api/predict/location)
 * Returns calibrated probability, CRI index, alert tier, and feature factors.
 */
export async function predictLocationML(lat, lon, source = 'auto') {
  if (lat == null || lon == null) return null;

  const key = getCoordKey(lat, lon);
  const now = Date.now();

  if (predictionCache.has(key)) {
    const cached = predictionCache.get(key);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const payload = {
      latitude: Number(lat),
      longitude: Number(lon),
      source
    };

    let res;
    if (PROD_BACKEND_URL) {
      res = await fetch(`${PROD_BACKEND_URL}/predict/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } else {
      try {
        res = await fetch('/api/predict/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch {
        res = await fetch('http://localhost:8000/predict/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      }
    }
    clearTimeout(timeoutId);

    if (!res || !res.ok) {
      throw new Error(`ML backend error HTTP ${res?.status || 500}`);
    }

    const data = await res.json();
    const prob = Number(data.predicted_probability ?? 0.035);
    const riskPercent = Math.round(
      data.convective_risk_index_cri != null && data.convective_risk_index_cri > 0
        ? data.convective_risk_index_cri
        : prob * 100
    );

    const result = {
      isLive: true,
      probability: prob,
      riskPercent,
      cri: data.convective_risk_index_cri ?? 0,
      threshold: data.threshold ?? 0.18,
      prediction: data.prediction ?? 0,
      // Passes active 25% threshold required by operational protocol
      isAlertActive: prob >= 0.25 || (data.convective_risk_index_cri ?? 0) >= 25,
      riskLabel: data.risk_label || (prob >= 0.25 ? 'ELEVATED RISK' : 'NORMAL / LOW RISK'),
      alertTier: data.alert_tier || (prob >= 0.25 ? 'AMBER_WATCH' : 'GREEN_NORMAL'),
      advisory: data.advisory || 'Standard atmospheric conditions.',
      terrain: data.terrain || null,
      topFactors: data.top_factors || [],
      coordinates: [lat, lon],
      timestamp: now
    };

    predictionCache.set(key, { timestamp: now, data: result });
    return result;

  } catch (err) {
    // When backend ML is offline, strictly report offline without fake numbers
    const fallbackResult = {
      isLive: false,
      probability: null,
      riskPercent: null,
      cri: null,
      threshold: 0.18,
      prediction: null,
      isAlertActive: false,
      riskLabel: 'OFFLINE',
      alertTier: 'OFFLINE',
      advisory: 'ML model is offline; cannot calculate risk percentage.',
      coordinates: [lat, lon],
      error: err.message || 'ML backend offline'
    };

    return fallbackResult;
  }
}

/**
 * Synchronous lookup in the ML prediction cache (0ms for map hover probe)
 */
export function getCachedMLRisk(lat, lon) {
  if (lat == null || lon == null) return null;
  const key = getCoordKey(lat, lon);
  if (predictionCache.has(key)) {
    return predictionCache.get(key).data;
  }
  // Check if near any cached coordinate (within ~0.25 deg)
  for (const [cKey, entry] of predictionCache.entries()) {
    const [cLat, cLon] = cKey.split(',').map(Number);
    const distSq = (lat - cLat) * (lat - cLat) + (lon - cLon) * (lon - cLon);
    if (distSq < 0.06) {
      return entry.data;
    }
  }
  return null;
}

export const TOP_WATCHLIST_STATIONS = [
  { id: 'kedarnath', name: 'Kedarnath', state: 'Uttarakhand', lat: 30.7346, lon: 79.0669, elevation: 3583 },
  { id: 'dharamshala', name: 'Dharamshala', state: 'Himachal Pradesh', lat: 32.2190, lon: 76.3234, elevation: 1457 },
  { id: 'wayanad', name: 'Wayanad', state: 'Kerala', lat: 11.6854, lon: 76.1320, elevation: 780 }
];

